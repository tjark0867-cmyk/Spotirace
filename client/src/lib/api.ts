import type {
  AlbumDetail,
  AppConfig,
  ArtistPage,
  ArtistSummary,
  ReleaseGroup,
  ReleasePage,
} from '../../../shared/types';

const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
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

export const api = {
  config: () => cached<AppConfig>('/api/config'),
  search: (q: string) => cached<ArtistSummary[]>(`/api/search?q=${encodeURIComponent(q.trim())}`),
  randomArtist: (exclude: string[]) =>
    fetchJson<ArtistSummary>(`/api/random-artist?exclude=${encodeURIComponent(exclude.join(','))}`),
  artistPage: (id: string) => cached<ArtistPage>(`/api/artist/${encodeURIComponent(id)}`),
  releases: (id: string, group: ReleaseGroup, offset: number) =>
    cached<ReleasePage>(`/api/artist/${encodeURIComponent(id)}/releases?group=${group}&offset=${offset}`),
  album: (id: string) => cached<AlbumDetail>(`/api/album/${encodeURIComponent(id)}`),
  forget: (prefix: string) => {
    for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
  },
};
