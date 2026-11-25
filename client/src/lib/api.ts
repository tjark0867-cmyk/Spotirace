import type {
  AlbumDetail,
  AppConfig,
  ArtistPage,
  ArtistSummary,
  PopularArtist,
  ReleaseGroup,
  ReleasePage,
} from '../../../shared/types';

const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(url: string, timeoutMs = 25_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch {
    throw new Error('Keine Antwort vom Server – bitte nochmal versuchen.');
  } finally {
    clearTimeout(timer);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* kein JSON */
  }
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error ?? `Fehler ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

/** Ruft eine URL ab und merkt sich das Ergebnis (fehlgeschlagene Anfragen werden nicht gemerkt). */
function cached<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit as Promise<T>;
  const promise = fetchJson<T>(url);
  promise.catch(() => cache.delete(url));
  cache.set(url, promise);
  return promise;
}

/** Fertige Alben merken; Zwischenstände (partial) nie – die werden nachgefragt */
const albums = new Map<string, AlbumDetail>();
const albumRuns = new Map<string, Promise<AlbumDetail>>();
function album(id: string, poll = false): Promise<AlbumDetail> {
  const done = albums.get(id);
  if (done) return Promise.resolve(done);
  const key = poll ? `${id}?poll` : id;
  const running = albumRuns.get(key);
  if (running) return running;
  const promise = fetchJson<AlbumDetail>(`/api/album/${encodeURIComponent(id)}${poll ? '?poll=1' : ''}`)
    .then((d) => {
      if (!d.partial) albums.set(id, d);
      return d;
    })
    .finally(() => albumRuns.delete(key));
  albumRuns.set(key, promise);
  return promise;
}

export const api = {
  config: () => cached<AppConfig>('/api/config'),
  configFresh: () => fetchJson<AppConfig>('/api/config'),
  search: (q: string) => cached<ArtistSummary[]>(`/api/search?q=${encodeURIComponent(q.trim())}`),
  popular: () => cached<PopularArtist[]>('/api/popular'),
  resolve: (name: string) => cached<ArtistSummary>(`/api/resolve?name=${encodeURIComponent(name)}`),
  randomArtist: (exclude: string[]) =>
    fetchJson<ArtistSummary>(`/api/random-artist?exclude=${encodeURIComponent(exclude.join(','))}`),
  artistPage: (id: string) => cached<ArtistPage>(`/api/artist/${encodeURIComponent(id)}`),
  releases: (id: string, group: ReleaseGroup, offset: number) =>
    cached<ReleasePage>(`/api/artist/${encodeURIComponent(id)}/releases?group=${group}&offset=${offset}`),
  album,
  forget: (prefix: string) => {
    for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
  },
};
