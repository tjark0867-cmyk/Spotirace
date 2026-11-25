import type { AlbumDetail, ArtistRef, ArtistSummary, PopularArtist, ReleaseGroup, ReleasePage, ReleaseSummary, TrackInfo } from '../../shared/types';
import { isPendingArtist, normName } from '../../shared/names';
import { TtlCache, type RemoteStore } from '../cache';
import type { DeezerProvider, Lane } from './deezerProvider';
import type { SpotifyProvider } from './spotify';
import type { MusicProvider } from './types';

/**
 * Spotify zuerst – wie am Anfang: Suche, Bilder, Diskografie und „Erscheint auf“ kommen von Spotify,
 * alle IDs sind Spotify-IDs. Nur die Songliste eines geöffneten Albums (früher der größte Kostenpunkt)
 * kommt unsichtbar von Deezer. Passt Deezer nicht sicher, wird das Album wie früher bei Spotify geladen.
 * Ist das Spotify-Kontingent aufgebraucht, läuft die nächste Runde komplett mit Deezer (Deezer-IDs sind Zahlen).
 */

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const KV_DAYS = (d: number) => d * 24 * 3600;

const isDeezerId = (id: string) => /^\d+$/.test(id);
/** Ab so vielen Songs kommt ein Album von Spotify (1 Anfrage) statt von Deezer (1 Anfrage pro Song) */
const BIG_ALBUM = 24;
const isBig = (info: { summary: ReleaseSummary }) => info.summary.totalTracks > BIG_ALBUM;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Abwechselnd aus Alben und „Erscheint auf“ – so sind von beiden Reihen die ersten Karten schnell da */
const interleave = (a: ReleaseSummary[], b: ReleaseSummary[], n: number) => {
  const out: string[] = [];
  for (let i = 0; out.length < n && (i < a.length || i < b.length); i++) {
    if (i < a.length) out.push(a[i].id);
    if (i < b.length && out.length < n) out.push(b[i].id);
  }
  return out;
};
const same = (a: string, b: string) => normName(a) === normName(b);
/** Stabile Song-IDs für beide Quellen: CD + Position */
const posId = (disc: number, number: number) => `${disc}-${number}`;

interface RelInfo {
  summary: ReleaseSummary;
  /** Spotify-Artists, auf deren Seite das Album steht (wirken also mit) */
  known: ArtistRef[];
}

export class MixedProvider implements MusicProvider {
  readonly name = 'spotify';
  private cache: TtlCache;

  /** Wie oft Spotify für ein Album eingesprungen ist (große Alben / Deezer voll) */
  private spilled = 0;

  constructor(
    readonly spotify: SpotifyProvider,
    private deezer: DeezerProvider,
    remote: RemoteStore | null,
    /** Darf Spotify zusätzlich einspringen? (Kontingent-Puffer) */
    private spare: () => boolean = () => true,
  ) {
    this.cache = new TtlCache(6000, remote);
  }

  get pageCount() {
    return this.spotify.pageCount;
  }

  /** Woher eine ID stammt – Start und Ziel müssen aus derselben Quelle kommen */
  idSource(id: string): string {
    return isDeezerId(id) ? 'deezer' : 'spotify';
  }

  /** Spotify probieren; klappt es nicht (Kontingent, Fehler), springt Deezer ein */
  private async spotifyOr<T>(viaSpotify: () => Promise<T>, viaDeezer: () => Promise<T>): Promise<T> {
    if (this.spotify.cooldownSeconds > 0) return viaDeezer();
    try {
      return await viaSpotify();
    } catch {
      return viaDeezer();
    }
  }

  searchArtists(q: string): Promise<ArtistSummary[]> {
    return this.spotifyOr(
      async () => this.famousFirst(await this.spotify.searchArtists(q)),
      () => this.deezer.searchArtists(q),
    );
  }

  /**
   * Gibt es mehrere Artists mit demselben Namen (z. B. drei „Favorite“), kommt der bekannteste nach oben:
   * Deezer verrät, wer die meisten Fans hat, eines seiner Alben zeigt bei Spotify, welche ID das ist.
   * Kostet einmalig 1 Spotify-Anfrage pro Name, danach 30 Tage gespeichert.
   */
  private async famousFirst(list: ArtistSummary[]): Promise<ArtistSummary[]> {
    const groups = new Map<string, ArtistSummary[]>();
    for (const a of list) {
      const k = normName(a.name);
      groups.set(k, [...(groups.get(k) ?? []), a]);
    }
    let out = list;
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      const famousId = await this.cache
        .wrap(
          `mx:famous:${key}`,
          DAY,
          async () => {
            const titles = await this.deezer.famousAlbumTitles(group[0].name);
            for (const t of titles) {
              const id = await this.spotify.findArtistByAlbum(group[0].name, t);
              if (id) return id;
            }
            return '';
          },
          KV_DAYS(30),
        )
        .catch(() => '');
      const hit = group.find((a) => a.id === famousId);
      if (!hit) continue;
      const first = out.findIndex((a) => normName(a.name) === key);
      const rest = out.filter((a) => a !== hit);
      rest.splice(first, 0, hit);
      out = rest;
    }
    return out;
  }

  popularArtists(): Promise<PopularArtist[]> {
    return this.spotifyOr(() => this.spotify.popularArtists(), () => this.deezer.popularArtists());
  }

  resolveArtist(name: string): Promise<ArtistSummary> {
    return this.spotifyOr(() => this.spotify.resolveArtist(name), () => this.deezer.resolveArtist(name));
  }

  randomArtist(excludeIds: string[]): Promise<ArtistSummary> {
    return this.spotifyOr(() => this.spotify.randomArtist(excludeIds), () => this.deezer.randomArtist(excludeIds));
  }

  getArtist(id: string): Promise<ArtistSummary> {
    return isDeezerId(id) ? this.deezer.getArtist(id) : this.spotify.getArtist(id);
  }

  // ---------- Diskografie (Spotify) ----------

  /** Merken, welche Alben auf welcher Artist-Seite stehen – damit die Deezer-Songliste richtig zugeordnet wird */
  private async remember(artistId: string, items: ReleaseSummary[]) {
    if (items.length === 0) return;
    const artist = await this.spotify.getArtist(artistId).catch(() => null);
    if (!artist) return;
    const me: ArtistRef = { id: artist.id, name: artist.name };
    for (const r of items) {
      const key = `mx:rel:${r.id}`;
      const old = await this.cache.peek<RelInfo>(key, DAY);
      if (old && old.known.some((k) => k.id === me.id)) continue;
      const info: RelInfo = { summary: r, known: [...(old?.known ?? []), me] };
      this.cache.put(key, info, DAY, KV_DAYS(60));
    }
  }

  async getInitialSections(artistId: string): Promise<{ album: ReleasePage; appears_on: ReleasePage }> {
    const res = isDeezerId(artistId) ? await this.deezer.getInitialSections(artistId) : await this.spotify.getInitialSections(artistId);
    if (!isDeezerId(artistId)) await this.remember(artistId, [...res.album.items, ...res.appears_on.items]);
    this.prefetch(interleave(res.album.items, res.appears_on.items, 10));
    return res;
  }

  async getReleases(artistId: string, group: ReleaseGroup, offset: number, count: number): Promise<ReleasePage> {
    if (isDeezerId(artistId)) return this.deezer.getReleases(artistId, group, offset, count);
    const page = await this.spotify.getReleases(artistId, group, offset, count);
    await this.remember(artistId, page.items);
    this.prefetch(page.items.slice(0, 6).map((r) => r.id));
    return page;
  }

  // ---------- Album: Songliste von Deezer, sonst Spotify ----------

  /** Album genau wie früher von Spotify (1 Anfrage, dann lange gespeichert) */
  private exact(id: string): Promise<AlbumDetail> {
    return this.cache.wrap(
      `mx:exact:${id}`,
      DAY,
      async () => {
        const a = await this.spotify.getAlbum(id);
        return { ...a, tracks: a.tracks.map((t) => ({ ...t, id: posId(t.disc, t.number) })) };
      },
      KV_DAYS(180),
    );
  }

  /** Deezer-Songs → Spotify-Album: bekannte Artists bekommen ihre Spotify-ID, Gäste ein "dz:" */
  private mapTracks(info: RelInfo, dzTracks: TrackInfo[]): TrackInfo[] {
    const s = info.summary;
    const known = [...s.artists, ...info.known];
    // Reihenfolge wie bei Spotify: Album-Künstler zuerst, dann die Gäste
    const rank = (aid: string) => {
      const i = s.artists.findIndex((x) => x.id === aid);
      return i === -1 ? 99 : i;
    };
    return dzTracks.map((t) => {
      const artists = t.artists.map((a) => {
        const k = known.find((x) => same(x.name, a.name));
        return k ? { id: k.id, name: k.name } : { id: `dz:${a.id}`, name: a.name };
      });
      artists.sort((x, y) => rank(x.id) - rank(y.id));
      return { ...t, id: posId(t.disc, t.number), artists };
    });
  }

  private head(id: string, s: ReleaseSummary, tracks: TrackInfo[]): AlbumDetail {
    return {
      id,
      name: s.name,
      cover: s.cover,
      coverSmall: s.coverSmall,
      type: s.type,
      year: s.year,
      totalTracks: s.totalTracks,
      artists: s.artists,
      tracks,
      url: `https://open.spotify.com/album/${id}`,
    };
  }

  /** Spotify-Album → Deezer-Album (sobald gefunden) – für den Zwischenstand */
  private dzFor = new Map<string, string>();

  /** Dasselbe Album bei Deezer (kostet kein Spotify-Kontingent) */
  private async fromDeezer(id: string, info: RelInfo): Promise<AlbumDetail | null> {
    const s = info.summary;
    const owner = s.artists[0]?.name ?? '';
    const match = await this.deezer.findAlbum(s.name, owner, s.totalTracks).catch(() => null);
    if (!match) return null;
    this.dzFor.set(id, String(match.id));
    if (this.dzFor.size > 2000) this.dzFor.delete(this.dzFor.keys().next().value!);
    const dz = await this.deezer.getAlbum(String(match.id)).catch(() => null);
    if (!dz || dz.tracks.length === 0) return null;
    const tracks = this.mapTracks(info, dz.tracks);
    // Gegenprobe: Wer das Album auf seiner Seite hat, muss auch auf einem Song stehen.
    // Sonst fehlen Deezer Angaben → lieber das echte Spotify-Album laden.
    const owners = s.artists.length === 1 && !/various artists/i.test(owner) ? s.artists : [];
    const required = [...owners, ...info.known];
    if (required.some((k) => !tracks.some((t) => t.artists.some((a) => a.id === k.id)))) return null;
    return this.head(id, s, tracks);
  }

  /** Nur über Deezer (gespeichert) – null, wenn Deezer nicht sicher passt. Nie Spotify. */
  private async viaDeezer(id: string, info: RelInfo): Promise<AlbumDetail | null> {
    const r = await this.cache
      .wrap(`mx:dz2:${id}:${info.known.length}`, DAY, async () => (await this.fromDeezer(id, info)) ?? { none: true }, KV_DAYS(60))
      .catch(() => null);
    return !r || 'none' in r ? null : (r as AlbumDetail);
  }

  /** Albums, die gerade laden – jede weitere Anfrage (z. B. Nachfragen der App) hängt sich an */
  private loading = new Map<string, Promise<AlbumDetail>>();

  getAlbum(id: string): Promise<AlbumDetail> {
    this.urgent(id);
    const running = this.loading.get(id);
    if (running) return running;
    const promise = this.loadAlbum(id).finally(() => this.loading.delete(id));
    this.loading.set(id, promise);
    return promise;
  }

  private async loadAlbum(id: string): Promise<AlbumDetail> {
    if (isDeezerId(id)) return this.deezer.getAlbum(id);
    const exact = await this.cache.peek<AlbumDetail>(`mx:exact:${id}`, DAY);
    if (exact) return exact;
    const info = await this.cache.peek<RelInfo>(`mx:rel:${id}`, DAY);
    if (!info) return this.exact(id);
    const key = `mx:dz2:${id}:${info.known.length}`;
    const have = await this.cache.peek<AlbumDetail | { none: true }>(key, DAY);
    if (have) return 'none' in have ? this.exact(id) : have;
    // Deezer braucht 1 Anfrage pro Song (max. 40 in 5 Sek. für ALLE Spieler). Bei großen Alben oder wenn
    // Deezer gerade voll ist, lieber 1 Spotify-Anfrage – aber nur, solange genug Spotify-Kontingent übrig ist.
    if (!this.cache.pending(key) && this.spotify.cooldownSeconds === 0 && this.spare()) {
      const big = isBig(info);
      if (big || this.deezer.congested(info.summary.totalTracks + 3)) {
        try {
          const a = await this.exact(id);
          this.spilled++;
          return a;
        } catch {
          /* Spotify klappt gerade nicht → Deezer */
        }
      }
    }
    const viaDeezer = await this.deezer.reserveRun(info.summary.totalTracks + 3, () => this.viaDeezer(id, info));
    return viaDeezer ?? this.exact(id);
  }

  /** Zwischenstand, solange Deezer noch lädt (Kopf sofort, Songs sobald die Liste da ist) */
  private async snapshot(id: string): Promise<AlbumDetail | null> {
    if (isDeezerId(id)) return this.deezer.albumSnapshot(id);
    const info = await this.cache.peek<RelInfo>(`mx:rel:${id}`, DAY);
    if (!info) return null;
    const dzId = this.dzFor.get(id);
    const dz = dzId ? this.deezer.albumSnapshot(dzId) : null;
    return { ...this.head(id, info.summary, dz ? this.mapTracks(info, dz.tracks) : []), partial: true };
  }

  /**
   * Für die App: Ist das Album in `waitMs` fertig, kommt es ganz. Sonst sofort der Zwischenstand
   * (die App fragt dann nach, bis alle Features da sind). Das Spiel selbst nutzt immer getAlbum.
   */
  async albumNow(id: string, waitMs: number): Promise<AlbumDetail> {
    const started = Date.now();
    const first = !this.loading.has(id);
    const cached = !isDeezerId(id) && (!!this.cache.get(`mx:exact:${id}`) || this.dzCached(id));
    const lane = this.running.has(id) ? 'deezer-vorgeladen' : null;
    const full = this.getAlbum(id);
    // Ladezeit nur beim ersten Aufruf messen (Nachfragen hängen sich an dieselbe Ladung)
    if (first) {
      full.then(
        (a) => this.note(id, a.name, Date.now() - started, cached ? 'gespeichert' : this.cache.get(`mx:exact:${id}`) === a ? 'spotify' : (lane ?? 'deezer')),
        () => this.note(id, '', Date.now() - started, 'fehler'),
      );
    } else {
      full.catch(() => {});
    }
    const deadline = started + waitMs;
    for (;;) {
      const left = deadline - Date.now();
      const done = await Promise.race([full, sleep(left > 0 ? Math.min(150, left) : 150).then(() => null)]);
      if (done) return done;
      if (Date.now() >= deadline) {
        const snap = await this.snapshot(id);
        if (snap) return snap;
      }
    }
  }

  private dzCached(id: string) {
    for (let n = 0; n < 6; n++) if (this.cache.get(`mx:dz2:${id}:${n}`)) return true;
    return false;
  }

  // ---------- Vorladen: Alben einer gerade geöffneten Artist-Seite schon mal holen ----------

  private queue: string[] = [];
  private running = new Map<string, Lane>();
  private working = false;
  private recent: Array<{ id: string; name: string; ms: number; how: string; at: string }> = [];

  /** Neueste Seite zuerst; nur Deezer (nie Spotify-Kontingent) und nur mit freien Plätzen */
  private prefetch(ids: string[]) {
    const fresh = ids.filter((id) => !this.running.has(id));
    if (fresh.length === 0) return;
    this.queue = [...fresh, ...this.queue.filter((id) => !fresh.includes(id))].slice(0, 30);
    if (!this.working) void this.work();
  }

  private async work() {
    this.working = true;
    try {
      while (this.queue.length > 0) {
        const id = this.queue.shift()!;
        const lane: Lane = { low: true };
        this.running.set(id, lane);
        try {
          await this.deezer.inLane(lane, () => this.warmAlbum(id));
        } catch {
          /* egal – beim Öffnen wird normal geladen */
        } finally {
          this.running.delete(id);
        }
      }
    } finally {
      this.working = false;
    }
  }

  /**
   * Billig vorladen: Album bei Deezer finden + Songliste holen (3 Anfragen statt 15+).
   * Beim Öffnen fehlen dann nur noch die Gäste pro Song – die kommen alle gleichzeitig.
   */
  private async warmAlbum(id: string) {
    if (isDeezerId(id)) {
      await this.deezer.prepareAlbum(id);
      return;
    }
    if (this.cache.get(`mx:exact:${id}`) || this.dzCached(id)) return;
    const info = await this.cache.peek<RelInfo>(`mx:rel:${id}`, DAY);
    if (!info || isBig(info)) return;
    const s = info.summary;
    const match = await this.deezer.findAlbum(s.name, s.artists[0]?.name ?? '', s.totalTracks);
    if (!match) return;
    await this.deezer.prepareAlbum(String(match.id));
  }

  /** Jemand öffnet dieses Album: aus der Vorlade-Liste nehmen bzw. laufendes Vorladen nach vorn holen */
  private urgent(id: string) {
    const i = this.queue.indexOf(id);
    if (i !== -1) this.queue.splice(i, 1);
    const lane = this.running.get(id);
    if (lane?.low) {
      lane.low = false;
      this.deezer.wake();
    }
  }

  private note(id: string, name: string, ms: number, how: string) {
    this.recent.unshift({ id, name, ms, how, at: new Date().toISOString().slice(11, 19) });
    this.recent.length = Math.min(this.recent.length, 25);
  }

  /** Für /api/debug: letzte Album-Ladezeiten + Zustand der Deezer-Warteschlange */
  get debug() {
    return {
      albums: this.recent,
      spotifyAlbums: this.spilled,
      spotifySpare: this.spare(),
      prefetchQueue: this.queue.length,
      prefetching: [...this.running.keys()],
      deezer: this.deezer.debug,
    };
  }

  /**
   * Jemand klickt auf einen Artist, den nur Deezer kannte: Jetzt das echte Spotify-Album laden
   * (1 Anfrage, danach ist das ganze Album exakt) und die Spotify-ID dieses Artists nehmen.
   */
  async resolveTrackArtist(albumId: string, trackId: string, artistId: string): Promise<string | null> {
    if (!isPendingArtist(artistId)) return artistId;
    const shown = await this.getAlbum(albumId);
    const track = shown.tracks.find((t) => t.id === trackId);
    const name = track?.artists.find((a) => a.id === artistId)?.name;
    if (!name) return null;
    const exact = await this.exact(albumId);
    const t = exact.tracks.find((x) => x.id === trackId && same(x.name, track!.name)) ?? exact.tracks.find((x) => same(x.name, track!.name)) ?? exact.tracks.find((x) => x.id === trackId);
    const hit = t?.artists.find((a) => same(a.name, name)) ?? exact.tracks.flatMap((x) => x.artists).find((a) => same(a.name, name));
    return hit?.id ?? null;
  }
}
