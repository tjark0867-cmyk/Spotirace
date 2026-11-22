import type { ReleaseGroup, ReleaseSummary } from '../../../shared/types';

export function formatTrackDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatAlbumLength(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} Min.`;
  return `${Math.floor(totalMin / 60)} Std. ${totalMin % 60} Min.`;
}

export const GROUP_LABELS: Record<ReleaseGroup, string> = {
  album: 'Alben',
  single: 'Singles & EPs',
  compilation: 'Compilations',
  appears_on: 'Erscheint auf',
};

export function releaseTypeLabel(type: string, totalTracks: number): string {
  if (type === 'album') return 'Album';
  if (type === 'compilation') return 'Compilation';
  if (type === 'single') return totalTracks >= 4 ? 'EP' : 'Single';
  return type;
}

/** "Deluxe", "Remastered", "Clean" usw. entfernen, um Duplikate zu erkennen */
const DUP_SUFFIX =
  /\s*(?:[([]|[-–—]\s)[^()[\]]*?\b(?:deluxe|edition|remaster(?:ed)?|version|expanded|anniversary|explicit|clean|bonus|special|collector'?s?|super|extended|complete|reissue)\b[^()[\]]*?[)\]]?\s*$/i;

export function normalizeReleaseName(name: string): string {
  let current = name.toLowerCase().trim();
  for (let i = 0; i < 3; i++) {
    const next = current.replace(DUP_SUFFIX, '').trim();
    if (next === current) break;
    current = next;
  }
  return current.replace(/\s+/g, ' ');
}

/**
 * Behält pro Titel nur eine Version – die mit den meisten Songs,
 * damit keine Features verloren gehen.
 */
export function dedupeReleases(items: ReleaseSummary[]): ReleaseSummary[] {
  const best = new Map<string, ReleaseSummary>();
  const order: string[] = [];
  for (const item of items) {
    const key = `${normalizeReleaseName(item.name)}|${item.artists.map((a) => a.id).join(',')}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, item);
      order.push(key);
    } else if (item.totalTracks > existing.totalTracks) {
      best.set(key, item);
    }
  }
  return order.map((k) => best.get(k)!);
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
