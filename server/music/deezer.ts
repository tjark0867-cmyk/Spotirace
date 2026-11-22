/**
 * Spotify verrät Development-Mode-Apps keine Popularität mehr.
 * Als Ersatz fragen wir die öffentliche Deezer-API (ohne Key) nach Fanzahlen.
 * Alles hier ist optional: Klappt Deezer nicht, läuft das Spiel einfach ohne diese Infos weiter.
 */

const DZ = 'https://api.deezer.com';

/** "Beyoncé" → "beyonce", "Tyler, The Creator" → "tylerthecreator" */
export function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function dz<T>(path: string, timeoutMs: number): Promise<T> {
  const res = await fetch(`${DZ}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  const json = (await res.json()) as T & { error?: unknown };
  if (json && typeof json === 'object' && 'error' in json && json.error) throw new Error('Deezer-Fehler');
  return json;
}

/** Fanzahlen für alle Artists, die Deezer zu dieser Suche findet (normalisierter Name → Fans) */
export async function deezerFans(query: string, timeoutMs = 900): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const json = await dz<{ data?: Array<{ name: string; nb_fan?: number }> }>(
      `/search/artist?q=${encodeURIComponent(query)}&limit=25`,
      timeoutMs,
    );
    for (const a of json.data ?? []) {
      const key = normName(a.name);
      map.set(key, Math.max(map.get(key) ?? 0, a.nb_fan ?? 0));
    }
  } catch {
    /* ohne Deezer geht es auch */
  }
  return map;
}

interface DzArtist {
  name: string;
  picture_medium?: string;
  picture_big?: string;
}

/** Aktuell meistgehörte Artists laut Deezer-Charts (Name + Bild) */
export async function deezerChart(limit = 20, timeoutMs = 3000): Promise<Array<{ name: string; image: string | null }>> {
  try {
    const json = await dz<{ data?: DzArtist[] }>(`/chart/0/artists?limit=${limit}`, timeoutMs);
    return (json.data ?? []).filter((a) => a.name).map((a) => ({ name: a.name, image: a.picture_big ?? a.picture_medium ?? null }));
  } catch {
    return [];
  }
}

/** Bild zu einem Artist-Namen (für Vorschläge) */
export async function deezerPicture(name: string, timeoutMs = 2500): Promise<string | null> {
  try {
    const json = await dz<{ data?: DzArtist[] }>(`/search/artist?q=${encodeURIComponent(name)}&limit=3`, timeoutMs);
    const hit = (json.data ?? []).find((a) => normName(a.name) === normName(name)) ?? json.data?.[0];
    return hit?.picture_big ?? hit?.picture_medium ?? null;
  } catch {
    return null;
  }
}
