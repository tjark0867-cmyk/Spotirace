import type {
  AlbumDetail,
  ArtistRef,
  ArtistSummary,
  PopularArtist,
  ReleaseGroup,
  ReleasePage,
  ReleaseSummary,
  TrackInfo,
} from '../../shared/types';
import { Limiter, TtlCache } from '../cache';
import { RANDOM_ARTIST_NAMES } from './randomArtists';
import { deezerChart, deezerFans, deezerPicture, normName } from './deezer';
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

/** Kleinstes Bild, das noch mindestens ~250 px breit ist (Spotify: 300 bzw. 320 px) → schnelleres Laden */
function smallImage(images: SpImage[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((i) => (i.width ?? 0) >= 250) ?? sorted[sorted.length - 1])?.url ?? null;
}

const toRef = (a: SpArtistSimple): ArtistRef => ({ id: a.id, name: a.name });

function toArtist(a: SpArtist): ArtistSummary {
  return {
    id: a.id,
    name: a.name,
    image: largestImage(a.images),
    imageSmall: smallImage(a.images),
    genres: a.genres ?? [],
    url: a.external_urls?.spotify ?? `https://open.spotify.com/artist/${a.id}`,
  };
}

function toRelease(a: SpAlbumSimple): ReleaseSummary {
  return {
    id: a.id,
    name: a.name,
    cover: largestImage(a.images),
    coverSmall: smallImage(a.images),
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
  // Wenige gleichzeitige Anfragen → Spotify drosselt uns nicht (Development Mode hat strenge Limits)
  private limiter = new Limiter(4);
  /** Bis wann Spotify uns gerade bremst (Rate-Limit) */
  private cooldownUntil = 0;
  /** true = Tageskontingent aufgebraucht (statt kurzer Bremse) */
  quotaExceeded = false;
  /** Max. Seitengröße für Listen – wird automatisch verkleinert, falls Spotify 20 ablehnt */
  private pageSize = 20;

  /** Pro Kategorie genau eine Anfrage → spart Spotify-Kontingent */
  get pageCount(): number {
    return this.pageSize;
  }
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
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3 && !res; attempt++) {
        try {
          res = await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${basic}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
            signal: AbortSignal.timeout(10_000),
          });
        } catch (err) {
          if (attempt === 2) {
            throw new ProviderError(502, `Spotify nicht erreichbar: ${err instanceof Error ? err.message : String(err)}`);
          }
          await sleep(400 * (attempt + 1));
        }
      }
      if (!res) throw new ProviderError(502, 'Spotify nicht erreichbar');
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

  /** Sekunden, die Spotify uns noch bremst (0 = alles frei) */
  get cooldownSeconds(): number {
    return Math.max(0, Math.ceil((this.cooldownUntil - Date.now()) / 1000));
  }

  private rateLimitError(): ProviderError {
    const sec = this.cooldownSeconds;
    const wait = sec >= 3600 ? `${Math.floor(sec / 3600)} Std. ${Math.round((sec % 3600) / 60)} Min.` : sec >= 90 ? `${Math.round(sec / 60)} Min.` : `${sec} Sek.`;
    return new ProviderError(
      503,
      this.quotaExceeded
        ? `Das Spotify-Kontingent ist für heute aufgebraucht. Spotify gibt es in ca. ${wait} wieder frei.`
        : `Spotify bremst gerade (zu viele Anfragen). Bitte in ${wait} nochmal versuchen.`,
    );
  }

  private async request<T>(pathOrUrl: string, attempt = 0): Promise<T> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${this.api}${pathOrUrl}`;
    // Während Spotify bremst: kurz warten oder sofort ehrlich Bescheid geben, statt ewig zu laden
    const wait = this.cooldownUntil - Date.now();
    if (wait > 0) {
      if (wait > 3000) throw this.rateLimitError();
      await sleep(wait);
    }
    const token = await this.getToken();
    let res: Response;
    try {
      res = await this.limiter.run(() =>
        fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }),
      );
    } catch (err) {
      // Netzwerk-Schluckauf (Verbindung abgebrochen, Timeout) → kurz warten und nochmal
      if (attempt < 2) {
        await sleep(300 * (attempt + 1));
        return this.request<T>(pathOrUrl, attempt + 1);
      }
      throw new ProviderError(502, `Spotify nicht erreichbar: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (res.status === 401 && attempt < 2) {
      this.token = null;
      return this.request<T>(pathOrUrl, attempt + 1);
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || 2;
      let reason = '';
      try {
        reason = JSON.stringify(await res.json());
      } catch {
        /* kein JSON */
      }
      this.quotaExceeded = /QUOTA_EXCEEDED/i.test(reason) || retryAfter > 3600;
      this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + retryAfter * 1000);
      console.warn(`[spotify] 429 – Spotify sagt: ${retryAfter}s warten ${reason}`);
      if (retryAfter <= 3 && attempt < 3) {
        await sleep(retryAfter * 1000 + Math.random() * 300);
        return this.request<T>(pathOrUrl, attempt + 1);
      }
      throw this.rateLimitError();
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
   * Lädt eine Liste seitenweise: erst eine Seite (liefert die Gesamtzahl), dann alle
   * weiteren Seiten gleichzeitig. Falls Spotify die Seitengröße 50 ablehnt,
   * wird automatisch auf 10 umgestellt.
   */
  private async fetchRange<T>(
    buildPath: (limit: number, offset: number) => string,
    offset: number,
    count: number,
  ): Promise<{ items: T[]; total: number; covered: number }> {
    let first: SpPaging<T>;
    let limit = Math.min(this.pageSize, count);
    for (;;) {
      try {
        first = await this.request<SpPaging<T>>(buildPath(limit, offset));
        break;
      } catch (err) {
        if (err instanceof ProviderError && err.status === 502 && /limit/i.test(err.message) && this.pageSize > 10) {
          console.warn(`[spotify] Seitengröße ${this.pageSize} abgelehnt – nutze ab jetzt 10`);
          this.pageSize = 10;
          limit = Math.min(this.pageSize, count);
          continue;
        }
        throw err;
      }
    }
    const total = first.total;
    const end = Math.min(total, offset + count);
    const items: T[] = [...first.items];
    // Spotify zählt Offsets in der ungefilterten Liste → immer um "limit" weiterspringen
    const offsets: number[] = [];
    for (let o = offset + limit; o < end; o += limit) offsets.push(o);
    if (offsets.length > 0) {
      const pages = await Promise.all(offsets.map((o) => this.request<SpPaging<T>>(buildPath(Math.min(limit, end - o), o))));
      for (const page of pages) items.push(...page.items);
    }
    return { items, total, covered: Math.max(end, offset + first.items.length) };
  }

  /** Reine Spotify-Suche (max. 10 Ergebnisse im Development Mode) */
  private async rawSearch(q: string): Promise<ArtistSummary[]> {
    return this.cache.wrap(`rawsearch:${q.toLowerCase()}`, HOUR, async () => {
      const json = await this.request<{ artists: SpPaging<SpArtist> }>(
        `/search?q=${encodeURIComponent(q)}&type=artist&limit=10`,
      );
      return json.artists.items.map(toArtist);
    });
  }

  /**
   * Suche mit "Bekannteste zuerst": Spotify liefert keine Popularität mehr, deshalb
   * kombinieren wir Deezer-Fanzahlen, unsere Liste bekannter Artists und die Spotify-Reihenfolge.
   */
  async searchArtists(query: string): Promise<ArtistSummary[]> {
    const q = query.trim();
    if (!q) return [];
    return this.cache.wrap(`search:${q.toLowerCase()}`, HOUR, async () => {
      const [items, fans] = await Promise.all([this.rawSearch(q), deezerFans(q)]);
      const nq = normName(q);
      const famous = new Set(RANDOM_ARTIST_NAMES.map(normName));
      const score = (a: ArtistSummary, index: number) => {
        const n = normName(a.name);
        const f = fans.get(n) ?? 0;
        return (
          Math.log10(f + 1) +
          (famous.has(n) ? 2 : 0) +
          (n === nq ? 1 : n.startsWith(nq) ? 0.4 : 0) +
          (a.image ? 0.2 : -0.6) -
          index * 0.08
        );
      };
      return items
        .map((a, i) => ({ a, s: score(a, i) }))
        .sort((x, y) => y.s - x.s)
        .map((x) => x.a);
    });
  }

  /**
   * Vorschläge: aktuelle Deezer-Charts + unsere Liste bekannter Artists.
   * Kostet KEINE Spotify-Anfragen – erst beim Antippen wird der Artist bei Spotify gesucht.
   */
  async popularArtists(): Promise<PopularArtist[]> {
    return this.cache.wrap('popular', 12 * HOUR, async () => {
      const chart = await deezerChart(12);
      const list: PopularArtist[] = [];
      const seen = new Set<string>();
      for (const a of chart.slice(0, 8)) {
        if (seen.has(normName(a.name))) continue;
        seen.add(normName(a.name));
        list.push(a);
      }
      const extra = RANDOM_ARTIST_NAMES.filter((n) => !seen.has(normName(n))).slice(0, 14 - list.length);
      const pictures = await Promise.all(extra.map((n) => deezerPicture(n)));
      extra.forEach((name, i) => list.push({ name, image: pictures[i] }));
      return list;
    });
  }

  async resolveArtist(name: string): Promise<ArtistSummary> {
    const hits = await this.rawSearch(name);
    const hit = hits.find((a) => normName(a.name) === normName(name)) ?? hits[0];
    if (!hit) throw new ProviderError(404, `„${name}“ nicht gefunden`);
    return hit;
  }

  async getArtist(id: string): Promise<ArtistSummary> {
    return this.cache.wrap(`artist:${id}`, DAY, async () => toArtist(await this.request<SpArtist>(`/artists/${encodeURIComponent(id)}`)));
  }

  async getReleases(artistId: string, group: ReleaseGroup, offset: number, count: number): Promise<ReleasePage> {
    const key = `releases:${artistId}:${group}:${offset}:${count}`;
    return this.cache.wrap(key, DAY, async () => {
      // Pro Kategorie eine eigene Anfrage, weil "album_group" im Development Mode fehlt
      const market = this.market ? `&market=${encodeURIComponent(this.market)}` : '';
      const { items, total, covered } = await this.fetchRange<SpAlbumSimple>(
        (limit, off) =>
          `/artists/${encodeURIComponent(artistId)}/albums?include_groups=${group}&limit=${limit}&offset=${off}${market}`,
        offset,
        count,
      );
      // Doppelte Einträge (kommen bei Spotify manchmal vor) entfernen
      const seen = new Set<string>();
      const unique = items.filter((a) => a && !seen.has(a.id) && seen.add(a.id));
      return {
        group,
        items: unique.map(toRelease),
        total,
        offset,
        next: covered < total ? covered : null,
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
        coverSmall: smallImage(album.images),
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
      const results = await this.rawSearch(name);
      const exact = results.find((a) => normName(a.name) === normName(name)) ?? results[0];
      if (exact && !excludeIds.includes(exact.id)) return exact;
    }
    throw new ProviderError(502, 'Konnte keinen zufälligen Artist finden');
  }
}
