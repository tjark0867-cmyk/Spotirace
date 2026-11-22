import type {
  AlbumDetail,
  ArtistSummary,
  ReleaseGroup,
  ReleasePage,
} from '../../shared/types';

/**
 * Alles, was das Spiel an Musikdaten braucht. Spotify ist die Standard-Quelle,
 * der Demo-Provider liefert erfundene Daten zum Testen ohne Keys.
 * Eine weitere Quelle (z. B. Deezer) kann man einbauen, indem man dieses
 * Interface implementiert.
 */
export interface MusicProvider {
  readonly name: string;
  searchArtists(query: string): Promise<ArtistSummary[]>;
  getArtist(id: string): Promise<ArtistSummary>;
  /** Liefert ab `offset` bis zu `count` Releases einer Kategorie */
  getReleases(artistId: string, group: ReleaseGroup, offset: number, count: number): Promise<ReleasePage>;
  getAlbum(id: string): Promise<AlbumDetail>;
  randomArtist(excludeIds: string[]): Promise<ArtistSummary>;
}

export class ProviderError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
