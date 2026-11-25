import type { AlbumDetail, ArtistRef, ArtistSummary, PopularArtist, ReleaseGroup, ReleasePage, ReleaseSummary, TrackInfo } from '../../shared/types';
import { TtlCache, type RemoteStore } from '../cache';
import { normName } from './deezer';
import { RANDOM_ARTIST_NAMES } from './randomArtists';
import { ProviderError, type MusicProvider } from './types';
import type { SpotifyProvider } from './spotify';

/**
 * Musikdaten von Deezer – ohne Key und ohne Tageskontingent (nur max. 50 Anfragen pro 5 Sekunden).
 * Liefert genau dieselben Felder wie vorher Spotify, damit die Oberfläche 1:1 gleich aussieht.
 */

const API = process.env.DEEZER_API_BASE || 'https://api.deezer.com';
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const KV_DAYS = (d: number) => d * 24 * 3600;

// ---- Deezer-Rohdaten (nur die Felder, die wir brauchen) ----
interface DzError { error?: { type?: string; message?: string; code?: number } }
interface DzArtist { id: number; name: string; picture_big?: string; picture_xl?: string; nb_fan?: number; link?: string }
interface DzRef { id: number; name: string; role?: string }
interface DzAlbumSimple {
  id: number;
  title: string;
  cover_big?: string;
  cover_xl?: string;
  release_date?: string;
  record_type?: string;
  nb_tracks?: number;
}
interface DzAlbum extends DzAlbumSimple { artist?: DzRef; contributors?: DzRef[]; link?: string }
interface DzTrack {
  id: number;
  title: string;
  duration?: number;
  explicit_lyrics?: boolean;
  track_position?: number;
  disk_number?: number;
  artist?: DzRef;
  contributors?: DzRef[];
  album?: DzAlbumSimple;
}
interface DzList<T> { data?: T[]; total?: number; next?: string }

/** Deezer-Platzhalterbild (Artist ohne Foto) → null, dann zeigt die App Initialen wie bei Spotify */
const img = (url: string | undefined) => (url && !/\/images\/(artist|cover)\/\//.test(url) ? url : null);

const spotifySearch = (q: string) => `https://open.spotify.com/search/${encodeURIComponent(q)}`;

function toArtist(a: DzArtist): ArtistSummary {
  return {
    id: String(a.id),
    name: a.name,
    image: img(a.picture_xl) ?? img(a.picture_big),
    imageSmall: img(a.picture_big) ?? img(a.picture_xl),
    genres: [],
    url: spotifySearch(a.name),
  };
}

const ref = (r: DzRef): ArtistRef => ({ id: String(r.id), name: r.name });

/** Deezer-Typ → Spotify-Typ (die App zeigt daraus "Album", "Single", "EP", "Compilation") */
function typeOf(recordType: string | undefined): { type: string; group: ReleaseGroup } {
  switch (recordType) {
    case 'single':
      return { type: 'single', group: 'single' };
    case 'ep':
      return { type: 'single', group: 'single' };
    case 'compile':
    case 'compilation':
      return { type: 'compilation', group: 'compilation' };
    default:
      return { type: 'album', group: 'album' };
  }
}

/** Bei EPs ohne Songzahl mindestens 4 annehmen, damit die App "EP" statt "Single" anzeigt */
function trackCount(a: DzAlbumSimple): number {
  if (a.nb_tracks) return a.nb_tracks;
  return a.record_type === 'ep' ? 4 : 1;
}

function toRelease(a: DzAlbumSimple, artists: ArtistRef[]): ReleaseSummary {
  return {
    id: String(a.id),
    name: a.title,
    cover: img(a.cover_xl) ?? img(a.cover_big),
    coverSmall: img(a.cover_big) ?? img(a.cover_xl),
    year: (a.release_date ?? '').slice(0, 4),
    type: typeOf(a.record_type).type,
    totalTracks: trackCount(a),
    artists,
  };
}

/** Hauptkünstler eines Albums (bei Kollabo-Alben mehrere) */
function albumArtists(a: DzAlbum): ArtistRef[] {
  const main = (a.contributors ?? []).filter((c) => !c.role || c.role === 'Main').map(ref);
  if (main.length > 0) return main;
  return a.artist ? [ref(a.artist)] : [];
}

const byDateDesc = (a: DzAlbumSimple, b: DzAlbumSimple) => (b.release_date ?? '').localeCompare(a.release_date ?? '');

/** Songtitel verrät oft Gäste: "(feat. X)", "with X", "A & B" */
const FEAT_HINT = /\b(feat\.?|ft\.?|featuring|with)\b|&|\sx\s/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Höchstens `max` Anfragen pro `windowMs` (Deezer erlaubt 50 pro 5 Sekunden) */
class RateGate {
  private stamps: number[] = [];
  private chain = Promise.resolve();
  constructor(
    private max: number,
    private windowMs: number,
  ) {}
  take(): Promise<void> {
    const next = this.chain.then(async () => {
      for (;;) {
        const now = Date.now();
        this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
        if (this.stamps.length < this.max) {
          this.stamps.push(now);
          return;
        }
        await sleep(this.windowMs - (now - this.stamps[0]) + 5);
      }
    });
    this.chain = next.catch(() => {});
    return next;
  }
}

export class DeezerProvider implements MusicProvider {
  readonly name = 'deezer';
  /** Alle Releases einer Kategorie kommen aus einer gespeicherten Liste – so viele zeigen wir pro Klick */
  readonly pageCount = 20;
  private cache: TtlCache;
  private gate = new RateGate(40, 5000);

  /** Optional: Spotify nur für Profilbild und „Erscheint auf“ (sonst alles Deezer) */
  private spotify: SpotifyProvider | null;

  constructor(opts: { remote?: RemoteStore | null; spotify?: SpotifyProvider | null } = {}) {
    this.cache = new TtlCache(8000, opts.remote ?? null);
    this.spotify = opts.spotify ?? null;
  }

  /**
   * Passender Spotify-Artist zu einem Deezer-Artist. Weil mehrere Artists gleich heißen können,
   * wird über ein eigenes Album abgeglichen: gesucht wird das Album bei Spotify, genommen wird der
   * Artist, der darauf steht (meist 1 Spotify-Anfrage, das Bild kommt kostenlos über oEmbed).
   * Bleibt 60 Tage gespeichert. Kein sicherer Treffer → null (dann Deezer-Bild statt falschem Bild).
   */
  private async spotifyMatch(deezerId: string, name: string): Promise<ArtistSummary | null> {
    if (!this.spotify) return null;
    const spotify = this.spotify;
    try {
      const found = await this.cache.wrap(
        `dz:sp2:${deezerId}`,
        DAY,
        async (): Promise<ArtistSummary | { none: true }> => {
          const own = await this.ownReleases(deezerId).catch(() => [] as DzAlbumSimple[]);
          const strip = (t: string) => t.replace(/\s*[([].*?[)\]]\s*/g, ' ').replace(/\s+-\s+.*$/, '').trim();
          const titles: string[] = [];
          for (const a of [...own.filter((x) => x.record_type === 'album'), ...own.filter((x) => x.record_type !== 'album')]) {
            const t = strip(a.title);
            if (t && !titles.some((x) => normName(x) === normName(t))) titles.push(t);
            if (titles.length >= 2) break;
          }
          for (const title of titles) {
            const spId = await spotify.findArtistByAlbum(name, title);
            if (spId) return spotify.getArtist(spId);
          }
          return (await spotify.uniqueArtist(name)) ?? { none: true };
        },
        KV_DAYS(60),
      );
      return 'none' in found ? null : found;
    } catch {
      return null; // Spotify-Pause oder Fehler: nicht merken, nächstes Mal wieder probieren
    }
  }

  /** Schon zugeordnetes Spotify-Bild nutzen, ohne neue Spotify-Anfrage */
  private async withKnownSpotifyImage(a: ArtistSummary): Promise<ArtistSummary> {
    const sp = await this.cache.peek<ArtistSummary | { none: true }>(`dz:sp2:${a.id}`, DAY);
    if (!sp || 'none' in sp || !sp.image) return a;
    return { ...a, image: sp.image, imageSmall: sp.imageSmall ?? sp.image, genres: sp.genres.length ? sp.genres : a.genres };
  }

  get cacheStats() {
    return this.cache.stats;
  }

  private async request<T>(path: string, attempt = 0): Promise<T> {
    await this.gate.take();
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    } catch {
      if (attempt < 2) {
        await sleep(600 * (attempt + 1));
        return this.request<T>(path, attempt + 1);
      }
      throw new ProviderError(502, 'Deezer ist gerade nicht erreichbar. Bitte gleich nochmal versuchen.');
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(800 * (attempt + 1));
      return this.request<T>(path, attempt + 1);
    }
    if (!res.ok) throw new ProviderError(502, `Deezer antwortet mit Fehler ${res.status}`);
    const json = (await res.json()) as T & DzError;
    if (json && typeof json === 'object' && json.error) {
      const code = json.error.code;
      // 4 = zu viele Anfragen in 5 Sekunden → kurz warten
      if (code === 4 && attempt < 3) {
        await sleep(5200);
        return this.request<T>(path, attempt + 1);
      }
      if (code === 800 || code === 801 || code === 803) throw new ProviderError(404, 'Nicht gefunden');
      throw new ProviderError(502, `Deezer-Fehler: ${json.error.message ?? json.error.type ?? 'unbekannt'}`);
    }
    return json;
  }

  /** Ganze Liste laden (Deezer liefert seitenweise, max. `cap` Einträge) */
  private async list<T>(path: string, cap = 300): Promise<T[]> {
    const sep = path.includes('?') ? '&' : '?';
    const out: T[] = [];
    let index = 0;
    for (;;) {
      const page = await this.request<DzList<T>>(`${path}${sep}limit=100&index=${index}`);
      const data = page.data ?? [];
      out.push(...data);
      index += data.length;
      if (!page.next || data.length === 0 || out.length >= cap || (page.total !== undefined && index >= page.total)) break;
    }
    return out.slice(0, cap);
  }

  // ---------- Suche & Vorschläge ----------

  private async rawSearch(q: string): Promise<DzArtist[]> {
    return this.cache.wrap(
      `dz:search:${q.toLowerCase()}`,
      HOUR,
      async () => (await this.request<DzList<DzArtist>>(`/search/artist?q=${encodeURIComponent(q)}&limit=25`)).data ?? [],
      KV_DAYS(2),
    );
  }

  /** Bekannteste zuerst: Fanzahl, exakter Name, Bild vorhanden */
  async searchArtists(query: string): Promise<ArtistSummary[]> {
    const q = query.trim();
    if (!q) return [];
    const hits = await this.rawSearch(q);
    const nq = normName(q);
    const famous = new Set(RANDOM_ARTIST_NAMES.map(normName));
    const score = (a: DzArtist, i: number) => {
      const n = normName(a.name);
      return (
        Math.log10((a.nb_fan ?? 0) + 1) +
        (famous.has(n) ? 2 : 0) +
        (n === nq ? 1 : n.startsWith(nq) ? 0.4 : 0) +
        (img(a.picture_big) ? 0.2 : -0.6) -
        i * 0.05
      );
    };
    const list = hits
      .map((a, i) => ({ a, s: score(a, i) }))
      .sort((x, y) => y.s - x.s)
      .slice(0, 10)
      .map((x) => toArtist(x.a));
    return Promise.all(list.map((a) => this.withKnownSpotifyImage(a)));
  }

  /** Vorschläge mit Spotify-Bildern: einmalig im Hintergrund zuordnen (12 Anfragen, 60 Tage gespeichert) */
  async popularArtists(): Promise<PopularArtist[]> {
    const base = await this.popularBase();
    const withImages = await Promise.all(
      base.map(async (p) => {
        if (!p.artist) return p;
        const a = await this.withKnownSpotifyImage(p.artist);
        if (a === p.artist) void this.getArtist(p.artist.id).catch(() => {});
        return { ...p, image: a.imageSmall ?? a.image, artist: a };
      }),
    );
    return withImages;
  }

  private async popularBase(): Promise<PopularArtist[]> {
    return this.cache.wrap(
      'dz:popular:v1',
      12 * HOUR,
      async () => {
        const names = RANDOM_ARTIST_NAMES.slice(0, 12);
        const found = await Promise.all(names.map((n) => this.resolveArtist(n).catch(() => null)));
        const list = found.filter((a): a is ArtistSummary => !!a).map((a) => ({ name: a.name, image: a.imageSmall ?? a.image, artist: a }));
        if (list.length === 0) throw new ProviderError(502, 'Vorschläge konnten nicht geladen werden');
        return list;
      },
      KV_DAYS(3),
    );
  }

  async resolveArtist(name: string): Promise<ArtistSummary> {
    const hits = await this.rawSearch(name);
    const exact = hits.filter((a) => normName(a.name) === normName(name)).sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0];
    const hit = exact ?? hits[0];
    if (!hit) throw new ProviderError(404, `„${name}“ nicht gefunden`);
    return toArtist(hit);
  }

  async randomArtist(excludeIds: string[]): Promise<ArtistSummary> {
    const names = [...RANDOM_ARTIST_NAMES].sort(() => Math.random() - 0.5);
    for (const name of names.slice(0, 5)) {
      const a = await this.resolveArtist(name).catch(() => null);
      if (a && !excludeIds.includes(a.id)) return a;
    }
    throw new ProviderError(502, 'Konnte keinen zufälligen Artist finden');
  }

  // ---------- Artist & Diskografie ----------

  private deezerArtist(id: string): Promise<ArtistSummary> {
    return this.cache.wrap(`dz:artist:${id}`, DAY, async () => toArtist(await this.request<DzArtist>(`/artist/${encodeURIComponent(id)}`)), KV_DAYS(14));
  }

  /** Artist von Deezer, Profilbild (und Genres) von Spotify, falls verfügbar */
  async getArtist(id: string): Promise<ArtistSummary> {
    const artist = await this.deezerArtist(id);
    const sp = await this.spotifyMatch(id, artist.name);
    if (!sp) return artist;
    return {
      ...artist,
      image: sp.image ?? artist.image,
      imageSmall: sp.imageSmall ?? sp.image ?? artist.imageSmall,
      genres: sp.genres.length ? sp.genres : artist.genres,
    };
  }

  /** Spotify-Album → dasselbe Album bei Deezer (zum Öffnen der Songs). Kein Spotify-Kontingent. */
  private deezerAlbumFor(title: string, artist: string): Promise<DzAlbum | null> {
    const clean = (t: string) => normName(t.replace(/\s*[([].*?[)\]]\s*/g, ' ').replace(/\s+-\s+.*$/, ''));
    return this.cache.wrap(
      `dz:map:${normName(artist)}:${normName(title)}`,
      DAY,
      async () => {
        const pick = (list: DzAlbum[]) =>
          list.find((a) => normName(a.title) === normName(title) && normName(a.artist?.name ?? '') === normName(artist)) ??
          list.find((a) => clean(a.title) === clean(title) && normName(a.artist?.name ?? '') === normName(artist)) ??
          list.find((a) => clean(a.title) === clean(title)) ??
          null;
        const exact = await this.request<DzList<DzAlbum>>(`/search/album?q=${encodeURIComponent(`artist:"${artist}" album:"${title}"`)}&limit=10`).catch(
          () => ({ data: [] }) as DzList<DzAlbum>,
        );
        let hit = pick(exact.data ?? []);
        if (!hit) {
          const loose = await this.request<DzList<DzAlbum>>(`/search/album?q=${encodeURIComponent(`${artist} ${title}`)}&limit=15`).catch(
            () => ({ data: [] }) as DzList<DzAlbum>,
          );
          hit = pick(loose.data ?? []);
        }
        return hit ?? { none: true };
      },
      KV_DAYS(60),
    ).then((r) => ('none' in r ? null : (r as DzAlbum)));
  }

  /**
   * „Erscheint auf“ von Spotify (1 Anfrage pro Seite): Namen, Cover und Jahr bleiben von Spotify,
   * die ID zeigt auf dasselbe Album bei Deezer, damit die Songs von dort kommen.
   * null → Spotify gerade nicht verfügbar, dann nimmt die App die Deezer-Liste.
   */
  private async spotifyAppearsOn(artistId: string, offset: number): Promise<ReleasePage | null> {
    if (!this.spotify) return null;
    const artist = await this.deezerArtist(artistId);
    const sp = await this.spotifyMatch(artistId, artist.name);
    if (!sp) return null;
    let page: ReleasePage;
    try {
      page = await this.spotify.getReleases(sp.id, 'appears_on', offset, this.spotify.pageCount);
    } catch {
      return null;
    }
    const mapped = await Promise.all(
      page.items.map(async (r) => {
        const owner = r.artists[0]?.name ?? '';
        const dz = await this.deezerAlbumFor(r.name, owner).catch(() => null);
        if (!dz) return null;
        // Album-Künstler mit Deezer-IDs, damit Klicks im Album passen
        const artists = dz.artist ? [ref(dz.artist)] : r.artists;
        return { ...r, id: String(dz.id), artists } satisfies ReleaseSummary;
      }),
    );
    const items = mapped.filter((r): r is ReleaseSummary => !!r);
    return { group: 'appears_on', items, total: Math.max(page.total - (page.items.length - items.length), items.length + offset), offset, next: page.next };
  }

  /** Albumkopf (Künstler, Jahr, Typ, Songzahl) – wird auch beim Öffnen des Albums wiederverwendet */
  private albumMeta(id: string): Promise<DzAlbum> {
    return this.cache.wrap(
      `dz:albummeta:${id}`,
      DAY,
      async () => {
        const a = await this.request<DzAlbum & { tracks?: unknown }>(`/album/${encodeURIComponent(id)}`);
        delete a.tracks;
        return a;
      },
      KV_DAYS(180),
    );
  }

  /** Eigene Releases (Alben, Singles/EPs, Compilations) – eine gespeicherte Liste für alle Kategorien */
  private ownReleases(artistId: string): Promise<DzAlbumSimple[]> {
    return this.cache.wrap(
      `dz:own:${artistId}`,
      DAY,
      async () => (await this.list<DzAlbumSimple>(`/artist/${encodeURIComponent(artistId)}/albums`)).sort(byDateDesc),
      KV_DAYS(14),
    );
  }

  /**
   * "Erscheint auf": Deezer hat dafür keine eigene Liste. Wir nehmen die Songs, auf denen der Artist
   * mitwirkt (Top-Songs mit allen Mitwirkenden + Songs mit "feat. Name" im Titel) und daraus die
   * Alben anderer Künstler.
   */
  private appearsOn(artistId: string): Promise<ReleaseSummary[]> {
    return this.cache.wrap(
      `dz:appears:${artistId}`,
      DAY,
      async () => {
        const [artist, own, top] = await Promise.all([
          this.deezerArtist(artistId),
          this.ownReleases(artistId),
          this.request<DzList<DzTrack>>(`/artist/${encodeURIComponent(artistId)}/top?limit=100`).catch(() => ({ data: [] }) as DzList<DzTrack>),
        ]);
        const ownIds = new Set(own.map((a) => String(a.id)));
        const nn = normName(artist.name);
        const feat = await this.request<DzList<DzTrack>>(`/search/track?q=${encodeURIComponent(`"${artist.name}"`)}&limit=100`).catch(
          () => ({ data: [] }) as DzList<DzTrack>,
        );
        const candidates = new Map<string, DzAlbumSimple>();
        const consider = (t: DzTrack, involved: boolean) => {
          if (!involved || !t.album) return;
          const id = String(t.album.id);
          if (!ownIds.has(id) && !candidates.has(id)) candidates.set(id, t.album);
        };
        for (const t of top.data ?? []) {
          const withArtist = (t.contributors ?? []).some((c) => String(c.id) === artistId) || String(t.artist?.id) === artistId;
          consider(t, withArtist && String(t.artist?.id) !== artistId);
        }
        for (const t of feat.data ?? []) {
          const byOther = String(t.artist?.id) !== artistId;
          const named = normName(t.title).includes(nn) && FEAT_HINT.test(t.title);
          consider(t, byOther && named);
        }
        // Für Jahr, Typ und Künstler die Albumköpfe nachladen (bleiben lange gespeichert)
        const metas = await Promise.all([...candidates.keys()].slice(0, 40).map((id) => this.albumMeta(id).catch(() => null)));
        return metas
          .filter((m): m is DzAlbum => !!m && !albumArtists(m).some((a) => a.id === artistId))
          .sort(byDateDesc)
          .map((m) => toRelease(m, albumArtists(m)));
      },
      KV_DAYS(14),
    );
  }

  private page(group: ReleaseGroup, all: ReleaseSummary[], offset: number, count: number): ReleasePage {
    const items = all.slice(offset, offset + count);
    const end = offset + items.length;
    return { group, items, total: all.length, offset, next: end < all.length ? end : null };
  }

  private async groupList(artistId: string, group: ReleaseGroup): Promise<ReleaseSummary[]> {
    if (group === 'appears_on') return this.appearsOn(artistId);
    const [artist, own] = await Promise.all([this.deezerArtist(artistId), this.ownReleases(artistId)]);
    const me: ArtistRef[] = [{ id: artist.id, name: artist.name }];
    return own.filter((a) => typeOf(a.record_type).group === group).map((a) => toRelease(a, me));
  }

  async getReleases(artistId: string, group: ReleaseGroup, offset: number, count: number): Promise<ReleasePage> {
    if (group === 'appears_on') {
      const sp = await this.spotifyAppearsOn(artistId, offset);
      if (sp) return sp;
    }
    return this.page(group, await this.groupList(artistId, group), offset, count);
  }

  async getInitialSections(artistId: string): Promise<{ album: ReleasePage; appears_on: ReleasePage }> {
    const [album, appears] = await Promise.all([this.groupList(artistId, 'album'), this.getReleases(artistId, 'appears_on', 0, this.pageCount)]);
    return { album: this.page('album', album, 0, this.pageCount), appears_on: appears };
  }

  // ---------- Album mit allen Mitwirkenden pro Song ----------

  async getAlbum(id: string): Promise<AlbumDetail> {
    return this.cache.wrap(
      `dz:album:${id}`,
      DAY,
      async () => {
        const [meta, tracks] = await Promise.all([this.albumMeta(id), this.list<DzTrack>(`/album/${encodeURIComponent(id)}/tracks`, 500)]);
        const main = albumArtists(meta);
        const mainId = main[0]?.id;
        // Gäste stehen bei Deezer nur in den Song-Details → nur dort nachladen, wo es Gäste geben kann
        const collab = (meta.contributors ?? []).length > 1 || main.length > 1;
        const detailed = await Promise.all(
          tracks.map(async (t) => {
            const maybeGuests = collab || String(t.artist?.id) !== mainId || FEAT_HINT.test(t.title);
            if (!maybeGuests) return t;
            const full = await this.cache
              .wrap(`dz:track:${t.id}`, DAY, () => this.request<DzTrack>(`/track/${t.id}`), KV_DAYS(180))
              .catch(() => null);
            return full ? { ...t, contributors: full.contributors } : t;
          }),
        );
        const info: TrackInfo[] = detailed.map((t, i) => {
          const people = (t.contributors?.length ? t.contributors : t.artist ? [t.artist] : []).map(ref);
          const seen = new Set<string>();
          return {
            id: String(t.id),
            name: t.title,
            number: t.track_position ?? i + 1,
            disc: t.disk_number ?? 1,
            durationMs: (t.duration ?? 0) * 1000,
            explicit: !!t.explicit_lyrics,
            artists: people.filter((p) => !seen.has(p.id) && seen.add(p.id)),
          };
        });
        const type = typeOf(meta.record_type).type;
        return {
          id: String(meta.id),
          name: meta.title,
          cover: img(meta.cover_xl) ?? img(meta.cover_big),
          coverSmall: img(meta.cover_big) ?? img(meta.cover_xl),
          type,
          year: (meta.release_date ?? '').slice(0, 4),
          totalTracks: meta.nb_tracks ?? info.length,
          artists: main,
          tracks: info.sort((a, b) => a.disc - b.disc || a.number - b.number),
          url: spotifySearch(`${meta.title} ${main[0]?.name ?? ''}`.trim()),
        };
      },
      KV_DAYS(180),
    );
  }
}
