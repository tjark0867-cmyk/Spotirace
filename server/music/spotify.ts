import type {
  AlbumDetail,
  ArtistRef,
  ArtistSummary,
  ReleaseGroup,
  ReleasePage,
  ReleaseSummary,
  TrackInfo,
} from '../../shared/types';
import { Limiter, TtlCache } from '../cache';
import { RANDOM_ARTIST_NAMES } from './randomArtists';
import { ProviderError, type MusicProvider } from './types';

const DEFAULT_API = 'https://api.spotify.com/v1';
const DEFAULT_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ---- Spotify-Rohdaten (nur die Felder, die wir brauchen) ----
interface SpImage { url: string; width: number | null; height: number | null }
interface SpArtistSimple { id: string; name: string }
interface SpArtist extends SpArtistSimple { images?: SpImage[]; genres?: string[]; external_urls?: { spotify?: string } }
interface SpAlbumSimple {
  id: string;
  name: string;
  album_type: string;
  total_tracks: number;
  release_date: string;
  images: SpImage[];
  artists: SpArtistSimple[];
  external_urls?: { spotify?: string };
}
interface SpTrackSimple {
  id: string;
  name: string;
  track_number: number;
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  artists: SpArtistSimple[];
}
interface SpPaging<T> { items: T[]; total: number; next: string | null; offset: number; limit: number }
interface SpAlbumFull extends SpAlbumSimple { tracks: SpPaging<SpTrackSimple> }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Größtes Bild nehmen → volle Cover-Auflösung */
function largestImage(images: SpImage[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}

const toRef = (a: SpArtistSimple): ArtistRef => ({ id: a.id, name: a.name });

function toArtist(a: SpArtist): ArtistSummary {
  return {
    id: a.id,
    name: a.name,
    image: largestImage(a.images),
    genres: a.genres ?? [],
    url: a.external_urls?.spotify ?? `https://open.spotify.com/artist/${a.id}`,
  };
}

function toRelease(a: SpAlbumSimple): ReleaseSummary {
  return {
    id: a.id,
    name: a.name,
    cover: largestImage(a.images),
    year: (a.release_date ?? '').slice(0, 4),
    type: a.album_type,
    totalTracks: a.total_tracks,
    artists: a.artists.map(toRef),
  };
}

function toTrack(t: SpTrackSimple): TrackInfo {
  return {
    id: t.id,
    name: t.name,
    number: t.track_number,
    disc: t.disc_number,
    durationMs: t.duration_ms,
    explicit: t.explicit,
    artists: t.artists.map(toRef),
  };
}

export class SpotifyProvider implements MusicProvider {
  readonly name = 'spotify';
  private token: { value: string; expiresAt: number } | null = null;
  private tokenPromise: Promise<string> | null = null;
  private cache = new TtlCache(8000);
  private limiter = new Limiter(6);
  /** Max. Seitengröße für Listen – wird automatisch verkleinert, falls Spotify 50 ablehnt */
  private pageSize = 50;
  // Nur zum Testen überschreibbar
  private api = process.env.SPOTIFY_API_BASE || DEFAULT_API;
  private tokenUrl = process.env.SPOTIFY_TOKEN_URL || DEFAULT_TOKEN_URL;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private market: string,
  ) {}

  // ---------- Auth (Client-Credentials-Flow) ----------

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = (async () => {
      const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const res = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const invalid = /invalid_client/i.test(text) || res.status === 400 || res.status === 401;
        throw new ProviderError(
          502,
          invalid
            ? 'Spotify lehnt die Keys ab: Client ID oder Client Secret ist falsch kopiert (oder vertauscht). Bitte beide nochmal mit dem Kopier-Symbol bei Spotify kopieren.'
            : `Spotify-Login fehlgeschlagen (${res.status}). ${text}`.trim(),
        );
      }
      const json = (await res.json()) as { access_token: string; expires_in: number };
      this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
      return json.access_token;
    })().finally(() => {
      this.tokenPromise = null;
    });
    return this.tokenPromise;
  }

  /** Testet den Login. Gibt null zurück, wenn alles passt, sonst eine Fehlermeldung. */
  async verify(): Promise<string | null> {
    try {
      this.token = null;
      await this.getToken();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  }

  // ---------- HTTP mit Retry bei 401 / 429 / 5xx ----------

  private async request<T>(pathOrUrl: string, attempt = 0): Promise<T> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${this.api}${pathOrUrl}`;
    const token = await this.getToken();
    const res = await this.limiter.run(() => fetch(url, { headers: { Authorization: `Bearer ${token}` } }));

    if (res.status === 401 && attempt < 2) {
      this.token = null;
      return this.request<T>(pathOrUrl, attempt + 1);
    }
    if (res.status === 429 && attempt < 4) {
      const retryAfter = Number(res.headers.get('retry-after')) || 2;
      console.warn(`[spotify] Rate-Limit erreicht – warte ${retryAfter}s`);
      await sleep(Math.min(retryAfter, 30) * 1000 + Math.random() * 300);
      return this.request<T>(pathOrUrl, attempt + 1);
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(600 * (attempt + 1));
      return this.request<T>(pathOrUrl, attempt + 1);
    }
    if (!res.ok) {
      let message = `Spotify-Fehler ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body?.error?.message) message += `: ${body.error.message}`;
      } catch {
        /* ignorieren */
      }
      if (res.status === 403) {
        message += ' – ist das Premium-Abo des App-Besitzers aktiv?';
      }
      throw new ProviderError(res.status === 404 ? 404 : 502, message);
    }
    return (await res.json()) as T;
  }

  /**
   * Lädt eine Liste seitenweise. Falls Spotify die Seitengröße 50 ablehnt,
   * wird automatisch auf 10 umgestellt.
   */
  private async fetchRange<T>(
    buildPath: (limit: number, offset: number) => string,
    offset: number,
    count: number,
  ): Promise<{ items: T[]; total: number }> {
    const items: T[] = [];
    let total = 0;
    let cursor = offset;
    while (items.length < count) {
      const limit = Math.min(this.pageSize, count - items.length);
      let page: SpPaging<T>;
      try {
        page = await this.request<SpPaging<T>>(buildPath(limit, cursor));
      } catch (err) {
        if (err instanceof ProviderError && err.status === 502 && /limit/i.test(err.message) && this.pageSize > 10) {
          console.warn('[spotify] Seitengröße 50 abgelehnt – nutze ab jetzt 10');
          this.pageSize = 10;
          continue;
        }
        throw err;
      }
      total = page.total;
      items.push(...page.items);
      cursor += page.items.length;
      if (!page.next || page.items.length === 0 || cursor >= total) break;
    }
    return { items, total };
  }

  // ---------- MusicProvider ----------

  async searchArtists(query: string): Promise<ArtistSummary[]> {
    const q = query.trim();
    if (!q) return [];
    return this.cache.wrap(`search:${q.toLowerCase()}`, HOUR, async () => {
      // Development Mode: max. 10 Ergebnisse
      const json = await this.request<{ artists: SpPaging<SpArtist> }>(
        `/search?q=${encodeURIComponent(q)}&type=artist&limit=10`,
      );
      return json.artists.items.map(toArtist);
    });
  }

  async getArtist(id: string): Promise<ArtistSummary> {
    return this.cache.wrap(`artist:${id}`, DAY, async () => toArtist(await this.request<SpArtist>(`/artists/${encodeURIComponent(id)}`)));
  }

  async getReleases(artistId: string, group: ReleaseGroup, offset: number, count: number): Promise<ReleasePage> {
    const key = `releases:${artistId}:${group}:${offset}:${count}`;
    return this.cache.wrap(key, DAY, async () => {
      // Pro Kategorie eine eigene Anfrage, weil "album_group" im Development Mode fehlt
      const market = this.market ? `&market=${encodeURIComponent(this.market)}` : '';
      const { items, total } = await this.fetchRange<SpAlbumSimple>(
        (limit, off) =>
          `/artists/${encodeURIComponent(artistId)}/albums?include_groups=${group}&limit=${limit}&offset=${off}${market}`,
        offset,
        count,
      );
      const end = offset + items.length;
      return {
        group,
        items: items.map(toRelease),
        total,
        offset,
        next: end < total && items.length > 0 ? end : null,
      };
    });
  }

  async getAlbum(id: string): Promise<AlbumDetail> {
    return this.cache.wrap(`album:${id}`, DAY, async () => {
      const album = await this.request<SpAlbumFull>(`/albums/${encodeURIComponent(id)}`);
      const tracks = [...album.tracks.items];
      if (album.tracks.next && tracks.length < album.tracks.total) {
        const rest = await this.fetchRange<SpTrackSimple>(
          (limit, off) => `/albums/${encodeURIComponent(id)}/tracks?limit=${limit}&offset=${off}`,
          tracks.length,
          Math.min(album.tracks.total, 500) - tracks.length,
        );
        tracks.push(...rest.items);
      }
      return {
        id: album.id,
        name: album.name,
        cover: largestImage(album.images),
        type: album.album_type,
        year: (album.release_date ?? '').slice(0, 4),
        totalTracks: album.total_tracks,
        artists: album.artists.map(toRef),
        tracks: tracks.filter((t) => t && t.id).map(toTrack),
        url: album.external_urls?.spotify ?? `https://open.spotify.com/album/${album.id}`,
      };
    });
  }

  async randomArtist(excludeIds: string[]): Promise<ArtistSummary> {
    const names = [...RANDOM_ARTIST_NAMES].sort(() => Math.random() - 0.5);
    for (const name of names.slice(0, 5)) {
      const results = await this.searchArtists(name);
      const exact = results.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? results[0];
      if (exact && !excludeIds.includes(exact.id)) return exact;
    }
    throw new ProviderError(502, 'Konnte keinen zufälligen Artist finden');
  }
}
