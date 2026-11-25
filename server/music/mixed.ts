import type { AlbumDetail, ArtistRef, ArtistSummary, PopularArtist, ReleaseGroup, ReleasePage, ReleaseSummary } from '../../shared/types';
import { isPendingArtist, normName } from '../../shared/names';
import { TtlCache, type RemoteStore } from '../cache';
import type { DeezerProvider } from './deezerProvider';
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

  constructor(
    readonly spotify: SpotifyProvider,
    private deezer: DeezerProvider,
    remote: RemoteStore | null,
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
    if (isDeezerId(artistId)) return this.deezer.getInitialSections(artistId);
    const res = await this.spotify.getInitialSections(artistId);
    await this.remember(artistId, [...res.album.items, ...res.appears_on.items]);
    return res;
  }

  async getReleases(artistId: string, group: ReleaseGroup, offset: number, count: number): Promise<ReleasePage> {
    if (isDeezerId(artistId)) return this.deezer.getReleases(artistId, group, offset, count);
    const page = await this.spotify.getReleases(artistId, group, offset, count);
    await this.remember(artistId, page.items);
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

  /** Dasselbe Album bei Deezer (kostet kein Spotify-Kontingent) */
  private async fromDeezer(id: string, info: RelInfo): Promise<AlbumDetail | null> {
    const s = info.summary;
    const owner = s.artists[0]?.name ?? '';
    const match = await this.deezer.findAlbum(s.name, owner, s.totalTracks).catch(() => null);
    if (!match) return null;
    const dz = await this.deezer.getAlbum(String(match.id)).catch(() => null);
    if (!dz || dz.tracks.length === 0) return null;
    const known = [...s.artists, ...info.known];
    const tracks = dz.tracks.map((t) => {
      const artists = t.artists.map((a) => {
        const k = known.find((x) => same(x.name, a.name));
        return k ? { id: k.id, name: k.name } : { id: `dz:${a.id}`, name: a.name };
      });
      // Reihenfolge wie bei Spotify: Album-Künstler zuerst, dann die Gäste
      const rank = (id: string) => {
        const i = s.artists.findIndex((x) => x.id === id);
        return i === -1 ? 99 : i;
      };
      artists.sort((x, y) => rank(x.id) - rank(y.id));
      return { ...t, id: posId(t.disc, t.number), artists };
    });
    // Gegenprobe: Wer das Album auf seiner Seite hat, muss auch auf einem Song stehen.
    // Sonst fehlen Deezer Angaben → lieber das echte Spotify-Album laden.
    const owners = s.artists.length === 1 && !/various artists/i.test(owner) ? s.artists : [];
    const required = [...owners, ...info.known];
    if (required.some((k) => !tracks.some((t) => t.artists.some((a) => a.id === k.id)))) return null;
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

  async getAlbum(id: string): Promise<AlbumDetail> {
    if (isDeezerId(id)) return this.deezer.getAlbum(id);
    const exact = await this.cache.peek<AlbumDetail>(`mx:exact:${id}`, DAY);
    if (exact) return exact;
    const info = await this.cache.peek<RelInfo>(`mx:rel:${id}`, DAY);
    if (!info) return this.exact(id);
    const viaDeezer = await this.cache
      .wrap(`mx:dz2:${id}:${info.known.length}`, DAY, async () => (await this.fromDeezer(id, info)) ?? { none: true }, KV_DAYS(60))
      .catch(() => null);
    if (!viaDeezer || 'none' in viaDeezer) return this.exact(id);
    return viaDeezer as AlbumDetail;
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
