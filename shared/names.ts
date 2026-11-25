import type { AlbumDetail, ArtistRef } from './types';

/** "Beyoncé" → "beyonce", "Tyler, The Creator" → "tylerthecreator" */
export function normName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Artist, dessen Spotify-ID noch nicht bekannt ist (Songliste kam von Deezer) */
export const isPendingArtist = (id: string) => id.startsWith('dz:');

/**
 * Songlisten von Deezer kennen nur Deezer-Artists. Wer namentlich zu einem bekannten
 * Spotify-Artist passt (aktueller Artist, Ziel …), bekommt dessen Spotify-ID.
 */
export function applyKnownArtists(album: AlbumDetail, known: Array<ArtistRef | null | undefined>): AlbumDetail {
  const list = known.filter((k): k is ArtistRef => !!k);
  if (list.length === 0 || !album.tracks.some((t) => t.artists.some((a) => isPendingArtist(a.id)))) return album;
  const byName = new Map(list.map((k) => [normName(k.name), k]));
  return {
    ...album,
    tracks: album.tracks.map((t) => ({
      ...t,
      artists: t.artists.map((a) => {
        if (!isPendingArtist(a.id)) return a;
        const k = byName.get(normName(a.name));
        return k ? { id: k.id, name: k.name } : a;
      }),
    })),
  };
}
