import type { AlbumDetail, ArtistSummary, ReleasePage } from '../../shared/types';
import { ProviderError, type MusicProvider } from './types';

const MESSAGE =
  'Spotify ist noch nicht verbunden: SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET fehlen. ' +
  'Bei Render unter "Environment" eintragen (lokal in der .env) und den Server neu starten.';

/** Wird benutzt, wenn keine Spotify-Keys gesetzt sind – keine erfundenen Daten, nur eine klare Meldung. */
export class MissingKeysProvider implements MusicProvider {
  readonly name = 'missing';
  private fail(): never {
    throw new ProviderError(503, MESSAGE);
  }
  async searchArtists(): Promise<ArtistSummary[]> {
    return this.fail();
  }
  async getArtist(): Promise<ArtistSummary> {
    return this.fail();
  }
  async getReleases(): Promise<ReleasePage> {
    return this.fail();
  }
  async getAlbum(): Promise<AlbumDetail> {
    return this.fail();
  }
  async randomArtist(): Promise<ArtistSummary> {
    return this.fail();
  }
}
