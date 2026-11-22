import type {
  AlbumDetail,
  ArtistSummary,
  PopularArtist,
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
  /** Bekannte Artists als Vorschläge für die Suche (ohne Spotify-Anfragen) */
  popularArtists(): Promise<PopularArtist[]>;
  /** Einen Vorschlag (Name) in einen Spotify-Artist verwandeln */
  resolveArtist(name: string): Promise<ArtistSummary>;
  /** Wie viele Releases pro Kategorie auf einmal geladen werden (1 Anfrage) */
  readonly pageCount: number;
}

export class ProviderError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
