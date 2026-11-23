// Gemeinsame Typen für Server und Client

// ---------- Musikdaten ----------

export interface ArtistRef {
  id: string;
  name: string;
}

export interface ArtistSummary {
  id: string;
  name: string;
  /** Größtes Bild (Header) */
  image: string | null;
  /** Kleineres Bild (~300 px) für Listen und Avatare – lädt schneller */
  imageSmall: string | null;
  genres: string[];
  url: string | null;
}

export type ReleaseGroup = 'album' | 'single' | 'compilation' | 'appears_on';

export const RELEASE_GROUPS: ReleaseGroup[] = ['album', 'single', 'compilation', 'appears_on'];

/** Diese Kategorien lädt eine Artist-Seite sofort, die anderen erst beim Antippen */
export const INITIAL_GROUPS: ReleaseGroup[] = ['album', 'appears_on'];

export interface ReleaseSummary {
  id: string;
  name: string;
  /** Volles Cover in höchster Auflösung */
  cover: string | null;
  /** Cover in ~300 px für das Raster – lädt viel schneller, ist aber trotzdem vollständig */
  coverSmall: string | null;
  year: string;
  /** album | single | compilation (Spotify album_type) */
  type: string;
  totalTracks: number;
  artists: ArtistRef[];
}

export interface ReleasePage {
  group: ReleaseGroup;
  items: ReleaseSummary[];
  total: number;
  offset: number;
  /** Offset für die nächste Seite oder null, wenn alles geladen ist */
  next: number | null;
  /** Gesetzt, wenn diese Kategorie nicht geladen werden konnte */
  error?: string;
  /** true = noch nicht geladen, erst beim Antippen (spart Spotify-Anfragen) */
  lazy?: boolean;
}

/** Vorschlag für die Suche – wird erst beim Antippen bei Spotify nachgeschlagen (spart Anfragen) */
export interface PopularArtist {
  name: string;
  image: string | null;
  /** Fertiger Spotify-Artist (dann ist beim Antippen keine Anfrage mehr nötig) */
  artist: ArtistSummary | null;
}

export interface ArtistPage {
  artist: ArtistSummary;
  sections: Record<ReleaseGroup, ReleasePage>;
}

export interface TrackInfo {
  id: string;
  name: string;
  number: number;
  disc: number;
  durationMs: number;
  explicit: boolean;
  artists: ArtistRef[];
}

export interface AlbumDetail {
  id: string;
  name: string;
  cover: string | null;
  coverSmall: string | null;
  type: string;
  year: string;
  totalTracks: number;
  artists: ArtistRef[];
  tracks: TrackInfo[];
  url: string | null;
}

// ---------- Spiel ----------

export type TimeLimit = 0 | 5 | 10 | 15;

export interface GameSettings {
  /** Minuten, 0 = kein Limit */
  timeLimitMin: TimeLimit;
  allowBack: boolean;
  showOpponents: boolean;
}

export type Phase = 'lobby' | 'countdown' | 'playing' | 'results';

export type PlayerStatus = 'idle' | 'playing' | 'finished' | 'gaveup' | 'timeout';

export interface PathVia {
  trackId: string;
  trackName: string;
  albumId: string;
  albumName: string;
  cover: string | null;
}

export interface PathStep {
  artist: ArtistSummary;
  /** Über welchen Song man hierher gekommen ist (null beim Start oder bei "Zurück") */
  via: PathVia | null;
  back: boolean;
  /** Millisekunden seit Spielstart */
  atMs: number;
}

export interface PlayerPublic {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  status: PlayerStatus;
  clicks: number;
  /** Aktueller Artist – null, wenn die Positionen der Gegner versteckt sind */
  current: ArtistSummary | null;
  finishMs: number | null;
  place: number | null;
  /** Kompletter Weg – nur auf dem Ergebnis-Screen */
  path: PathStep[] | null;
}

export interface RoomState {
  code: string;
  phase: Phase;
  you: string;
  players: PlayerPublic[];
  start: ArtistSummary | null;
  target: ArtistSummary | null;
  settings: GameSettings;
  startAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
  serverNow: number;
  yourPath: PathStep[];
  round: number;
}

// ---------- WebSocket-Nachrichten ----------

export type ClientMessage =
  | { t: 'hello'; sessionId: string }
  | { t: 'create'; name: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'leave' }
  | { t: 'setArtist'; which: 'start' | 'target'; artist: ArtistSummary | null }
  | { t: 'settings'; settings: Partial<GameSettings> }
  | { t: 'ready'; ready: boolean }
  | { t: 'start' }
  | { t: 'move'; albumId: string; trackId: string; artistId: string }
  | { t: 'back' }
  | { t: 'giveUp' }
  | { t: 'again' }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'state'; state: RoomState }
  | { t: 'noRoom' }
  | { t: 'error'; message: string }
  | { t: 'moveFailed'; message: string }
  | { t: 'pong' };

export interface SetupStatus {
  idFound: boolean;
  secretFound: boolean;
  /** Ergebnis des Test-Logins bei Spotify */
  login: 'ok' | 'failed' | 'unknown';
  loginError: string | null;
  hints: string[];
}

export interface AppConfig {
  demo: boolean;
  /** true, wenn Spotify (noch) nicht benutzbar ist: Keys fehlen oder Login klappt nicht */
  missingKeys: boolean;
  setup: SetupStatus | null;
  /** Sekunden, die Spotify gerade noch bremst (Rate-Limit), sonst 0 */
  cooldownSeconds: number;
  /** Verbrauch des Spotify-Kontingents (null im Demo-Modus) */
  usage: UsageInfo | null;
}

export interface UsageInfo {
  /** Anfragen an Spotify heute (deutsche Zeit) */
  today: number;
  /** Bei welchem Stand Spotify zuletzt "aufgebraucht" gemeldet hat */
  lastLimit: { count: number; at: number } | null;
  /** Gemessene Anfragen pro Spieler und Runde (gleitender Mittelwert) */
  perPlayerRound: number | null;
  /** true = Zähler und Zwischenspeicher überstehen Neustarts (Key Value aktiv) */
  persistent: boolean;
}
