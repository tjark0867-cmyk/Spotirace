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

/** Aktuell meistgehörte Artists laut Deezer-Charts (nur Namen) */
export async function deezerChartNames(limit = 20, timeoutMs = 3000): Promise<string[]> {
  try {
    const json = await dz<{ data?: Array<{ name: string }> }>(`/chart/0/artists?limit=${limit}`, timeoutMs);
    return (json.data ?? []).map((a) => a.name).filter(Boolean);
  } catch {
    return [];
  }
}
