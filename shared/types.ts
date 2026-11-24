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

export type GameMode = 'classic' | 'relay';

export interface GameSettings {
  /** Minuten, 0 = kein Limit */
  timeLimitMin: TimeLimit;
  allowBack: boolean;
  showOpponents: boolean;
  /** Klassisch (jeder für sich) oder Team-Staffel */
  mode: GameMode;
  /** Power-ups an/aus – geht in beiden Modi */
  sabotage: boolean;
}

export type Phase = 'lobby' | 'countdown' | 'playing' | 'results';

export type PlayerStatus = 'idle' | 'playing' | 'finished' | 'gaveup' | 'timeout';

// ---------- Team-Staffel ----------

export type TeamId = 'green' | 'pink';
export const TEAM_IDS: TeamId[] = ['green', 'pink'];
export const TEAM_NAMES: Record<TeamId, string> = { green: 'Team Grün', pink: 'Team Pink' };
export const TEAM_COLORS: Record<TeamId, string> = { green: '#1ed760', pink: '#ff4fa0' };

/** Wie lange die Stab-Übergabe dauert, bevor der nächste Läufer klicken kann */
export const HANDOVER_MS = 2800;
/** So lange muss der aktive Läufer weg sein, bis ein Teamkollege übernehmen darf */
export const TAKEOVER_MS = 30_000;

export interface LegPublic {
  index: number;
  runnerId: string;
  runnerName: string;
  runnerColor: string;
  from: ArtistSummary;
  to: ArtistSummary;
  /** Serverzeit, ab der der Läufer klicken darf (null = Etappe noch nicht dran) */
  startAt: number | null;
  /** Serverzeit, zu der die Etappe geschafft war */
  endAt: number | null;
  clicks: number;
  /** Wo der Läufer gerade ist – fürs eigene Team immer, für Gegner nur mit "Gegner live sehen" */
  current: ArtistSummary | null;
  /** Weg der Etappe – fürs eigene Team live, für alle im Ergebnis */
  path: PathStep[] | null;
}

export interface TeamPublic {
  id: TeamId;
  /** Spieler-IDs in Lauf-Reihenfolge */
  members: string[];
  status: PlayerStatus;
  place: number | null;
  /** Summe aller Etappenzeiten */
  finishMs: number | null;
  clicks: number;
  /** Index der laufenden Etappe */
  active: number;
  legs: LegPublic[];
  /** Ab wann ein Teamkollege übernehmen darf (Läufer offline), sonst null */
  takeoverAt: number | null;
}

export type CheerKind = 'flame' | 'thumb' | 'bolt';
export const CHEER_KINDS: CheerKind[] = ['flame', 'thumb', 'bolt'];

// ---------- Sabotage ----------

export type ItemKind = 'freeze' | 'ink' | 'rewind' | 'shield' | 'key' | 'peek';
export const ITEM_KINDS: ItemKind[] = ['freeze', 'ink', 'rewind', 'shield', 'key', 'peek'];
/** Diese Items richten sich gegen einen Gegner */
export const ATTACK_ITEMS: ItemKind[] = ['freeze', 'ink', 'rewind'];

export const ITEM_INFO: Record<ItemKind, { name: string; text: string; durationMs: number }> = {
  freeze: { name: 'Eiskristall', text: 'Friert einen Gegner 10 s ein – keine Klicks', durationMs: 10_000 },
  ink: { name: 'Tintenklecks', text: 'Verschmiert 15 s alle Cover und Bilder beim Gegner', durationMs: 15_000 },
  rewind: { name: 'Rückspulen', text: 'Setzt einen Gegner einen Artist zurück', durationMs: 0 },
  shield: { name: 'Schild', text: 'Blockt den nächsten Angriff, hält 30 s', durationMs: 30_000 },
  key: { name: 'Generalschlüssel', text: '15 s lang sind auch gesperrte Songs auswählbar', durationMs: 15_000 },
  peek: { name: 'Spickzettel', text: 'Zeigt 15 s Genres und Cover deines Ziels', durationMs: 15_000 },
};

export const MAX_ITEMS = 2;
/** Nach so vielen Sprüngen gibt es eine Item-Kiste */
export const JUMPS_PER_CRATE = 2;
export const ATTACK_COOLDOWN_MS = 20_000;

/** Endzeiten (Serverzeit) der laufenden Effekte, null = nicht aktiv */
export interface Effects {
  frozenUntil: number | null;
  inkUntil: number | null;
  shieldUntil: number | null;
  keyUntil: number | null;
  peekUntil: number | null;
}

export interface PeekInfo {
  artist: ArtistSummary;
  genres: string[];
  covers: Array<{ id: string; name: string; cover: string | null }>;
}

/** Was du gerade an Power-ups hast (nur für dich selbst sichtbar) */
export interface SabotageYou {
  items: ItemKind[];
  /** Noch so viele Sprünge bis zur nächsten Kiste */
  crateIn: number;
  /** Ab wann du wieder angreifen darfst */
  attackReadyAt: number;
  peek: PeekInfo | null;
}

export type FxEvent =
  | { kind: 'crate'; player: string; item: ItemKind }
  | { kind: 'crateFull'; player: string }
  | { kind: 'item'; item: ItemKind; from: string; to: string | null; blocked: boolean }
  | { kind: 'handover'; team: TeamId; from: string; to: string; leg: number; at: ArtistSummary; startAt: number }
  | { kind: 'takeover'; team: TeamId; by: string; from: string }
  | { kind: 'cheer'; team: TeamId; by: string; sticker: CheerKind };

// ---------- Spielstand ----------

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
  /** true, wenn ein Gegner einen zurückgespult hat */
  rewind?: boolean;
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
  /** Team-Staffel: in welchem Team (auch schon in der Lobby) */
  team: TeamId | null;
  /** Laufende Effekte (Schild, eingefroren …) – für alle sichtbar */
  effects: Effects;
  itemCount: number;
  /** Sabotage-Statistik dieser Runde */
  attacksSent: number;
  attacksHit: number;
}

export interface RoomState {
  code: string;
  phase: Phase;
  you: string;
  players: PlayerPublic[];
  start: ArtistSummary | null;
  target: ArtistSummary | null;
  /** Team-Staffel: Wechselpunkte zwischen Start und Ziel (B, C) */
  checkpoints: Array<ArtistSummary | null>;
  settings: GameSettings;
  startAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
  serverNow: number;
  /** Dein Weg – in der Staffel der Weg deiner laufenden Etappe (leer, wenn du nicht dran bist) */
  yourPath: PathStep[];
  round: number;
  /** Team-Staffel: beide Teams (null im klassischen Modus) */
  teams: TeamPublic[] | null;
  /** Sabotage: dein Inventar (null, wenn aus) */
  sabotage: SabotageYou | null;
}

// ---------- WebSocket-Nachrichten ----------

export type ClientMessage =
  | { t: 'hello'; sessionId: string }
  | { t: 'create'; name: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'leave' }
  | { t: 'setArtist'; which: 'start' | 'target' | 'checkpoint'; index?: number; artist: ArtistSummary | null }
  | { t: 'settings'; settings: Partial<GameSettings> }
  | { t: 'ready'; ready: boolean }
  | { t: 'setTeam'; team: TeamId | null }
  | { t: 'shuffleTeams' }
  | { t: 'start' }
  | { t: 'move'; albumId: string; trackId: string; artistId: string }
  | { t: 'back' }
  | { t: 'giveUp' }
  | { t: 'useItem'; slot: number; targetId?: string }
  | { t: 'cheer'; sticker: CheerKind }
  | { t: 'takeover' }
  | { t: 'again' }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'state'; state: RoomState }
  | { t: 'noRoom' }
  | { t: 'error'; message: string }
  | { t: 'moveFailed'; message: string }
  | { t: 'fx'; fx: FxEvent }
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
