import { randomBytes, randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_ITEMS,
  CHEER_KINDS,
  HANDOVER_MS,
  ITEM_INFO,
  ITEM_KINDS,
  JUMPS_PER_CRATE,
  MAX_ITEMS,
  TAKEOVER_MS,
  TEAM_IDS,
  TEAM_NAMES,
  type ArtistSummary,
  type CheerKind,
  type ClientMessage,
  type Effects,
  type FxEvent,
  type GameMode,
  type GameSettings,
  type ItemKind,
  type LegPublic,
  type PathStep,
  type PeekInfo,
  type Phase,
  type PlayerPublic,
  type PlayerStatus,
  type RoomState,
  type ServerMessage,
  type TeamId,
  type TeamPublic,
  type TimeLimit,
} from '../shared/types';
import type { MusicProvider } from './music/types';
import type { UsageCounter } from './usage';

const COUNTDOWN_MS = 3500;
const LOBBY_DISCONNECT_GRACE_MS = 45_000;
const HOST_DISCONNECT_GRACE_MS = 10_000;
const EMPTY_ROOM_TTL_MS = 10 * 60_000;
const MAX_PLAYERS = 12;
const MAX_TEAM_SIZE = 3;
const CHEER_GAP_MS = 1200;

const COLORS = [
  '#1ed760', '#ff6437', '#509bf5', '#f573a0', '#ffc864', '#b49bc8',
  '#e8115b', '#27856a', '#ff4632', '#8d67ab', '#1e3264', '#e1118c',
];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Zufalls-Gewichte der Items (Angriffe etwas häufiger) */
const ITEM_WEIGHTS: Record<ItemKind, number> = { freeze: 18, ink: 18, rewind: 16, shield: 16, key: 16, peek: 16 };

/** Ein Lauf: wo man ist, wie man hingekommen ist. Klassisch hat jeder Spieler einen, in der Staffel jede Etappe. */
interface Run {
  stack: ArtistSummary[];
  path: PathStep[];
  clicks: number;
  busy: boolean;
}

interface Player {
  id: string;
  sessionId: string;
  name: string;
  color: string;
  ready: boolean;
  socket: WebSocket | null;
  offlineSince: number | null;
  status: PlayerStatus;
  run: Run;
  finishMs: number | null;
  place: number | null;
  disconnectTimer: NodeJS.Timeout | null;
  /** Team-Staffel: Wahl in der Lobby */
  team: TeamId | null;
  /** Reihenfolge innerhalb des Teams (wer zuerst beitritt, läuft zuerst) */
  teamSeq: number;
  // Sabotage
  items: ItemKind[];
  jumps: number;
  effects: Effects;
  attackReadyAt: number;
  peek: PeekInfo | null;
  attacksSent: number;
  attacksHit: number;
  cheerAt: number;
}

interface Leg {
  index: number;
  runnerId: string;
  runnerName: string;
  runnerColor: string;
  from: ArtistSummary;
  to: ArtistSummary;
  startAt: number | null;
  endAt: number | null;
  run: Run;
}

interface Team {
  id: TeamId;
  members: string[];
  legs: Leg[];
  active: number;
  status: PlayerStatus;
  place: number | null;
  finishMs: number | null;
}

interface Room {
  code: string;
  hostId: string;
  players: Player[];
  phase: Phase;
  start: ArtistSummary | null;
  target: ArtistSummary | null;
  /** Wechselpunkte der Staffel (B, C) */
  checkpoints: Array<ArtistSummary | null>;
  settings: GameSettings;
  startAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
  round: number;
  timers: NodeJS.Timeout[];
  hostTimer: NodeJS.Timeout | null;
  emptySince: number | null;
  /** Zählerstand der Spotify-Anfragen beim Rundenstart */
  usageAtStart: number | null;
  /** Laufende/beendete Staffel (null im klassischen Modus und in der Lobby) */
  teams: Team[] | null;
  /** Spickzettel: pro Ziel-Artist höchstens eine Abfrage pro Runde */
  peekCache: Map<string, PeekInfo>;
}

interface ActiveRun {
  run: Run;
  goal: ArtistSummary;
  team: Team | null;
  leg: Leg | null;
}

export interface GameOptions {
  countdownMs?: number;
  handoverMs?: number;
  takeoverMs?: number;
  now?: () => number;
  random?: () => number;
  /** Nur Demo/Tests: feste Reihenfolge der Kisten-Items statt Zufall */
  itemSequence?: ItemKind[];
}

class GameError extends Error {}

function cleanName(name: unknown): string {
  const s = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 20) : '';
  return s || 'Spieler';
}

function isArtist(a: unknown): a is ArtistSummary {
  const x = a as ArtistSummary;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string';
}

function sanitizeArtist(a: ArtistSummary): ArtistSummary {
  return {
    id: String(a.id).slice(0, 64),
    name: String(a.name).slice(0, 200),
    image: typeof a.image === 'string' ? a.image.slice(0, 500) : null,
    imageSmall: typeof a.imageSmall === 'string' ? a.imageSmall.slice(0, 500) : null,
    genres: Array.isArray(a.genres) ? a.genres.slice(0, 5).map((g) => String(g).slice(0, 50)) : [],
    url: typeof a.url === 'string' ? a.url.slice(0, 300) : null,
  };
}

const newRun = (start: ArtistSummary | null, atMs = 0): Run => ({
  stack: start ? [start] : [],
  path: start ? [{ artist: start, via: null, back: false, atMs }] : [],
  clicks: 0,
  busy: false,
});

const noEffects = (): Effects => ({ frozenUntil: null, inkUntil: null, shieldUntil: null, keyUntil: null, peekUntil: null });

export class GameServer {
  private rooms = new Map<string, Room>();
  /** sessionId → Raumcode */
  private sessionRoom = new Map<string, string>();
  /** sessionId → aktive Verbindung (auch ohne Raum) */
  private sessionSocket = new Map<string, WebSocket>();
  private seq = 0;

  private countdownMs: number;
  private handoverMs: number;
  private takeoverMs: number;
  private now: () => number;
  private random: () => number;
  private itemSequence: ItemKind[];
  private itemPos = 0;

  constructor(
    private provider: MusicProvider,
    /** Lädt eine Artist-Seite schon mal in den Cache, damit sie gleich sofort da ist */
    private warm: (artistId: string) => void = () => {},
    /** Misst, wie viele Spotify-Anfragen eine Runde kostet */
    private usage: UsageCounter | null = null,
    options: GameOptions = {},
  ) {
    this.countdownMs = options.countdownMs ?? COUNTDOWN_MS;
    this.handoverMs = options.handoverMs ?? HANDOVER_MS;
    this.takeoverMs = options.takeoverMs ?? TAKEOVER_MS;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.itemSequence = (options.itemSequence ?? []).filter((k) => ITEM_KINDS.includes(k));
    setInterval(() => this.sweep(), 60_000).unref();
  }

  // ---------- Verbindungen ----------

  attach(ws: WebSocket) {
    let sessionId: string | null = null;

    ws.on('message', async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;

      try {
        if (msg.t === 'ping') return this.send(ws, { t: 'pong' });
        if (msg.t === 'hello') {
          sessionId = typeof msg.sessionId === 'string' && msg.sessionId.length <= 100 ? msg.sessionId : randomUUID();
          this.hello(ws, sessionId);
          return;
        }
        if (!sessionId) throw new GameError('Nicht verbunden');
        await this.handle(ws, sessionId, msg);
      } catch (err) {
        const moveLike = msg.t === 'move' || msg.t === 'back';
        if (err instanceof GameError) {
          this.send(ws, moveLike ? { t: 'moveFailed', message: err.message } : { t: 'error', message: err.message });
        } else {
          console.error('[game] Fehler:', err);
          const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
          this.send(ws, moveLike ? { t: 'moveFailed', message } : { t: 'error', message });
        }
      }
    });

    ws.on('close', () => {
      if (sessionId && this.sessionSocket.get(sessionId) === ws) {
        this.sessionSocket.delete(sessionId);
        this.disconnected(sessionId, ws);
      }
    });
  }

  private hello(ws: WebSocket, sessionId: string) {
    const old = this.sessionSocket.get(sessionId);
    if (old && old !== ws) {
      try {
        old.close(4000, 'Neue Verbindung');
      } catch {
        /* egal */
      }
    }
    this.sessionSocket.set(sessionId, ws);

    const room = this.roomOfSession(sessionId);
    const player = room?.players.find((p) => p.sessionId === sessionId);
    if (!room || !player) {
      this.sessionRoom.delete(sessionId);
      this.send(ws, { t: 'noRoom' });
      return;
    }
    // Wieder da nach Reload / Verbindungsabbruch
    player.socket = ws;
    player.offlineSince = null;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
    if (room.hostId === player.id && room.hostTimer) {
      clearTimeout(room.hostTimer);
      room.hostTimer = null;
    }
    room.emptySince = null;
    this.broadcast(room);
  }

  private disconnected(sessionId: string, ws: WebSocket) {
    const room = this.roomOfSession(sessionId);
    const player = room?.players.find((p) => p.sessionId === sessionId);
    if (!room || !player || player.socket !== ws) return;
    player.socket = null;
    player.offlineSince = this.now();

    if (room.phase === 'lobby') {
      player.disconnectTimer = setTimeout(() => this.removePlayer(room, player), LOBBY_DISCONNECT_GRACE_MS);
    }
    if (room.hostId === player.id) {
      room.hostTimer = setTimeout(() => {
        room.hostTimer = null;
        const next = room.players.find((p) => p.socket && p.id !== player.id);
        if (next && !player.socket) {
          room.hostId = next.id;
          this.broadcast(room);
        }
      }, HOST_DISCONNECT_GRACE_MS);
    }
    if (!room.players.some((p) => p.socket)) room.emptySince = Date.now();
    this.broadcast(room);
  }

  // ---------- Nachrichten ----------

  private async handle(ws: WebSocket, sessionId: string, msg: ClientMessage) {
    switch (msg.t) {
      case 'create':
        return this.create(ws, sessionId, msg.name);
      case 'join':
        return this.join(ws, sessionId, msg.code, msg.name);
    }

    const room = this.roomOfSession(sessionId);
    const player = room?.players.find((p) => p.sessionId === sessionId);
    if (!room || !player) {
      this.send(ws, { t: 'noRoom' });
      return;
    }
    const isHost = room.hostId === player.id;
    const hostOnly = () => {
      if (!isHost) throw new GameError('Nur der Host kann das ändern');
    };
    const lobbyOnly = () => {
      if (room.phase !== 'lobby') throw new GameError('Das geht nur in der Lobby');
    };

    switch (msg.t) {
      case 'leave':
        this.removePlayer(room, player);
        this.sessionRoom.delete(sessionId);
        this.send(ws, { t: 'noRoom' });
        return;

      case 'setArtist':
        hostOnly();
        lobbyOnly();
        return this.setArtist(room, msg.which, msg.index, msg.artist);

      case 'settings': {
        hostOnly();
        lobbyOnly();
        const s = msg.settings ?? {};
        if (s.timeLimitMin !== undefined && [0, 5, 10, 15].includes(s.timeLimitMin)) room.settings.timeLimitMin = s.timeLimitMin as TimeLimit;
        if (typeof s.allowBack === 'boolean') room.settings.allowBack = s.allowBack;
        if (typeof s.showOpponents === 'boolean') room.settings.showOpponents = s.showOpponents;
        if (typeof s.sabotage === 'boolean') room.settings.sabotage = s.sabotage;
        if (s.mode === 'classic' || s.mode === 'relay') {
          room.settings.mode = s.mode as GameMode;
          if (s.mode === 'relay') for (const p of room.players) if (!p.team) this.autoAssign(room, p);
        }
        return this.broadcast(room);
      }

      case 'ready':
        lobbyOnly();
        player.ready = !!msg.ready;
        return this.broadcast(room);

      case 'setTeam': {
        lobbyOnly();
        const team = msg.team === 'green' || msg.team === 'pink' ? msg.team : null;
        if (team && player.team !== team && this.lobbyMembers(room, team).length >= MAX_TEAM_SIZE) {
          throw new GameError(`${TEAM_NAMES[team]} ist schon voll (max. ${MAX_TEAM_SIZE})`);
        }
        if (team !== player.team) {
          player.team = team;
          player.teamSeq = ++this.seq;
        }
        return this.broadcast(room);
      }

      case 'shuffleTeams':
        hostOnly();
        lobbyOnly();
        return this.shuffleTeams(room);

      case 'start':
        hostOnly();
        lobbyOnly();
        return this.startGame(room);

      case 'move':
        return this.move(room, player, msg.albumId, msg.trackId, msg.artistId);

      case 'back':
        return this.back(room, player);

      case 'giveUp':
        return this.giveUp(room, player);

      case 'useItem':
        return this.useItem(room, player, msg.slot, msg.targetId);

      case 'cheer':
        return this.cheer(room, player, msg.sticker);

      case 'takeover':
        return this.takeover(room, player);

      case 'again':
        hostOnly();
        if (room.phase !== 'results') throw new GameError('Die Runde läuft noch');
        return this.backToLobby(room);
    }
  }

  private setArtist(room: Room, which: 'start' | 'target' | 'checkpoint', index: number | undefined, raw: ArtistSummary | null) {
    const artist = raw && isArtist(raw) ? sanitizeArtist(raw) : null;
    if (which === 'checkpoint') {
      const i = Number(index);
      if (!Number.isInteger(i) || i < 0 || i > 1) throw new GameError('Ungültiger Wechselpunkt');
      if (artist) this.assertUnique(room, artist.id, { which, index: i });
      room.checkpoints[i] = artist;
    } else {
      if (artist) this.assertUnique(room, artist.id, { which, index: 0 });
      if (which === 'start') room.start = artist;
      else room.target = artist;
      if (artist && which === 'start') this.warm(artist.id);
    }
    this.broadcast(room);
    // Vollständige Artist-Daten nachladen (z. B. Spotify-Profilbild statt Suchbild)
    if (artist) {
      this.provider
        .getArtist(artist.id)
        .then((full) => {
          const slots: Array<[() => ArtistSummary | null, (a: ArtistSummary) => void]> = [
            [() => room.start, (a) => (room.start = a)],
            [() => room.target, (a) => (room.target = a)],
            [() => room.checkpoints[0], (a) => (room.checkpoints[0] = a)],
            [() => room.checkpoints[1], (a) => (room.checkpoints[1] = a)],
          ];
          let changed = false;
          for (const [get, set] of slots) {
            const cur = get();
            if (cur && cur.id === full.id && (cur.image !== full.image || cur.genres.join() !== full.genres.join())) {
              set({ ...cur, image: full.image, imageSmall: full.imageSmall, genres: full.genres });
              changed = true;
            }
          }
          if (changed && room.phase === 'lobby') this.broadcast(room);
        })
        .catch(() => {});
    }
  }

  /** Start, Wechselpunkte und Ziel müssen verschiedene Artists sein */
  private assertUnique(room: Room, id: string, slot: { which: string; index: number }) {
    const others: Array<[string, number, ArtistSummary | null]> = [
      ['start', 0, room.start],
      ['target', 0, room.target],
      ['checkpoint', 0, room.checkpoints[0]],
      ['checkpoint', 1, room.checkpoints[1]],
    ];
    const relay = room.settings.mode === 'relay';
    for (const [w, i, a] of others) {
      if (w === slot.which && i === slot.index) continue;
      if (!relay && w === 'checkpoint') continue;
      if (a && a.id === id) {
        throw new GameError(relay ? 'Start, Wechselpunkte und Ziel müssen verschiedene Artists sein' : 'Start und Ziel müssen verschiedene Artists sein');
      }
    }
  }

  private create(ws: WebSocket, sessionId: string, name: string) {
    this.leaveCurrent(sessionId);
    let code = '';
    do {
      code = Array.from(randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
    } while (this.rooms.has(code));

    const player = this.newPlayer(sessionId, cleanName(name), COLORS[0], ws);
    const room: Room = {
      code,
      hostId: player.id,
      players: [player],
      phase: 'lobby',
      start: null,
      target: null,
      checkpoints: [null, null],
      settings: { timeLimitMin: 0, allowBack: true, showOpponents: true, mode: 'classic', sabotage: false },
      startAt: null,
      endsAt: null,
      endedAt: null,
      round: 1,
      timers: [],
      hostTimer: null,
      emptySince: null,
      usageAtStart: null,
      teams: null,
      peekCache: new Map(),
    };
    this.rooms.set(code, room);
    this.sessionRoom.set(sessionId, code);
    console.log(`[game] Lobby ${code} erstellt von ${player.name}`);
    this.broadcast(room);
  }

  private join(ws: WebSocket, sessionId: string, rawCode: string, name: string) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) throw new GameError(`Lobby "${code}" nicht gefunden`);

    const existing = room.players.find((p) => p.sessionId === sessionId);
    if (existing) {
      existing.socket = ws;
      existing.offlineSince = null;
      if (existing.disconnectTimer) clearTimeout(existing.disconnectTimer);
      existing.disconnectTimer = null;
      room.emptySince = null;
      this.sessionRoom.set(sessionId, code);
      this.broadcast(room);
      return;
    }
    if (room.players.length >= MAX_PLAYERS) throw new GameError('Die Lobby ist voll');
    this.leaveCurrent(sessionId);

    // Doppelte Namen vermeiden
    let finalName = cleanName(name);
    const taken = new Set(room.players.map((p) => p.name.toLowerCase()));
    for (let i = 2; taken.has(finalName.toLowerCase()); i++) finalName = `${cleanName(name).slice(0, 17)} ${i}`;

    const usedColors = new Set(room.players.map((p) => p.color));
    const color = COLORS.find((c) => !usedColors.has(c)) ?? COLORS[room.players.length % COLORS.length];
    const player = this.newPlayer(sessionId, finalName, color, ws);
    room.players.push(player);
    if (room.phase === 'lobby' && room.settings.mode === 'relay') this.autoAssign(room, player);
    room.emptySince = null;
    this.sessionRoom.set(sessionId, code);
    this.broadcast(room);
  }

  private newPlayer(sessionId: string, name: string, color: string, ws: WebSocket): Player {
    return {
      id: randomUUID().slice(0, 8),
      sessionId,
      name,
      color,
      ready: false,
      socket: ws,
      offlineSince: null,
      status: 'idle',
      run: newRun(null),
      finishMs: null,
      place: null,
      disconnectTimer: null,
      team: null,
      teamSeq: 0,
      items: [],
      jumps: 0,
      effects: noEffects(),
      attackReadyAt: 0,
      peek: null,
      attacksSent: 0,
      attacksHit: 0,
      cheerAt: 0,
    };
  }

  private leaveCurrent(sessionId: string) {
    const room = this.roomOfSession(sessionId);
    const player = room?.players.find((p) => p.sessionId === sessionId);
    if (room && player) this.removePlayer(room, player);
    this.sessionRoom.delete(sessionId);
  }

  private removePlayer(room: Room, player: Player) {
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    room.players = room.players.filter((p) => p.id !== player.id);
    if (this.sessionRoom.get(player.sessionId) === room.code) this.sessionRoom.delete(player.sessionId);

    if (room.players.length === 0) {
      this.destroyRoom(room);
      return;
    }
    if (room.hostId === player.id) {
      const next = room.players.find((p) => p.socket) ?? room.players[0];
      room.hostId = next.id;
      next.ready = false;
    }
    // Staffel: Ist vom Team niemand mehr da, scheidet es aus
    if (room.teams) {
      for (const team of room.teams) {
        if (team.status === 'playing' && !team.members.some((id) => room.players.some((p) => p.id === id))) team.status = 'gaveup';
      }
    }
    this.checkEnd(room);
    this.broadcast(room);
  }

  private destroyRoom(room: Room) {
    room.timers.forEach(clearTimeout);
    if (room.hostTimer) clearTimeout(room.hostTimer);
    room.players.forEach((p) => p.disconnectTimer && clearTimeout(p.disconnectTimer));
    this.rooms.delete(room.code);
    console.log(`[game] Lobby ${room.code} geschlossen`);
  }

  // ---------- Teams (Lobby) ----------

  private lobbyMembers(room: Room, team: TeamId): Player[] {
    return room.players.filter((p) => p.team === team).sort((a, b) => a.teamSeq - b.teamSeq);
  }

  /** Neue Spieler landen im kleineren Team (solange dort Platz ist) */
  private autoAssign(room: Room, player: Player) {
    const [a, b] = TEAM_IDS.map((t) => this.lobbyMembers(room, t).length);
    const team: TeamId | null = a <= b ? (a < MAX_TEAM_SIZE ? 'green' : null) : b < MAX_TEAM_SIZE ? 'pink' : null;
    player.team = team;
    player.teamSeq = ++this.seq;
  }

  private shuffleTeams(room: Room) {
    const pool = room.players.filter((p) => p.socket);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const size = Math.min(MAX_TEAM_SIZE, Math.floor(pool.length / 2));
    for (const p of room.players) p.team = null;
    pool.forEach((p, i) => {
      p.team = i < size * 2 ? (i % 2 === 0 ? 'green' : 'pink') : null;
      p.teamSeq = ++this.seq;
    });
    this.broadcast(room);
  }

  // ---------- Spielablauf ----------

  private startGame(room: Room) {
    if (!room.start || !room.target) throw new GameError('Wähle zuerst Start- und Ziel-Artist');
    if (room.start.id === room.target.id) throw new GameError('Start und Ziel müssen verschiedene Artists sein');
    const notReady = room.players.filter((p) => p.socket && p.id !== room.hostId && !p.ready);
    if (notReady.length > 0) {
      throw new GameError(`Noch nicht bereit: ${notReady.map((p) => p.name).join(', ')}`);
    }

    const relay = room.settings.mode === 'relay';
    let route: ArtistSummary[] = [room.start, room.target];
    let lineup: Record<TeamId, Player[]> | null = null;
    if (relay) {
      lineup = { green: this.lobbyMembers(room, 'green'), pink: this.lobbyMembers(room, 'pink') };
      const size = lineup.green.length;
      if (size !== lineup.pink.length || size < 2 || size > MAX_TEAM_SIZE) {
        throw new GameError('Für die Staffel braucht ihr zwei gleich große Teams mit je 2 oder 3 Spielern');
      }
      const offline = [...lineup.green, ...lineup.pink].filter((p) => !p.socket);
      if (offline.length > 0) throw new GameError(`Nicht verbunden: ${offline.map((p) => p.name).join(', ')}`);
      const cps = room.checkpoints.slice(0, size - 1);
      if (cps.some((c) => !c)) throw new GameError(size === 2 ? 'Wähle den Wechselpunkt' : 'Wähle beide Wechselpunkte');
      route = [room.start, ...(cps as ArtistSummary[]), room.target];
      if (new Set(route.map((a) => a.id)).size !== route.length) {
        throw new GameError('Start, Wechselpunkte und Ziel müssen verschiedene Artists sein');
      }
    }

    const now = this.now();
    room.phase = 'countdown';
    room.startAt = now + this.countdownMs;
    room.endsAt = room.settings.timeLimitMin > 0 ? room.startAt + room.settings.timeLimitMin * 60_000 : null;
    room.endedAt = null;
    room.usageAtStart = this.usage ? this.usage.total : null;
    room.peekCache = new Map();

    for (const p of room.players) {
      p.finishMs = null;
      p.place = null;
      p.items = [];
      p.jumps = 0;
      p.effects = noEffects();
      p.attackReadyAt = 0;
      p.peek = null;
      p.attacksSent = 0;
      p.attacksHit = 0;
      p.cheerAt = 0;
      p.run = newRun(null);
      p.status = 'idle';
    }

    if (lineup) {
      const startAt = room.startAt;
      room.teams = TEAM_IDS.map((id) => {
        const members = lineup![id];
        for (const m of members) m.status = 'playing';
        return {
          id,
          members: members.map((m) => m.id),
          legs: members.map((m, i) => ({
            index: i,
            runnerId: m.id,
            runnerName: m.name,
            runnerColor: m.color,
            from: route[i],
            to: route[i + 1],
            startAt: i === 0 ? startAt : null,
            endAt: null,
            run: i === 0 ? newRun(route[0], 0) : newRun(null),
          })),
          active: 0,
          status: 'playing' as PlayerStatus,
          place: null,
          finishMs: null,
        };
      });
    } else {
      room.teams = null;
      for (const p of room.players) {
        // Offline-Spieler schauen diese Runde zu
        if (p.socket) {
          p.status = 'playing';
          p.run = newRun(room.start, 0);
        }
      }
    }

    room.timers.push(
      setTimeout(() => {
        if (room.phase !== 'countdown') return;
        room.phase = 'playing';
        this.broadcast(room);
      }, this.countdownMs),
    );
    if (room.endsAt) {
      room.timers.push(setTimeout(() => this.endGame(room), room.endsAt - now));
    }
    console.log(`[game] Lobby ${room.code}: Runde ${room.round} startet (${route.map((a) => a.name).join(' → ')}${relay ? ', Staffel' : ''}${room.settings.sabotage ? ', Sabotage' : ''})`);
    this.broadcast(room);
  }

  private teamOf(room: Room, playerId: string): Team | null {
    return room.teams?.find((t) => t.members.includes(playerId)) ?? null;
  }

  /** Der Lauf, den dieser Spieler gerade steuern darf (oder ein Fehler, warum nicht) */
  private activeRun(room: Room, player: Player): ActiveRun {
    if (room.teams) {
      const team = this.teamOf(room, player.id);
      if (!team || team.status !== 'playing') throw new GameError('Du bist in dieser Runde nicht (mehr) unterwegs');
      const leg = team.legs[team.active];
      if (leg.runnerId !== player.id) throw new GameError('Gerade läuft jemand anderes aus deinem Team');
      if (leg.startAt === null || this.now() < leg.startAt) throw new GameError('Gleich geht’s los – der Stab wird noch übergeben');
      return { run: leg.run, goal: leg.to, team, leg };
    }
    if (player.status !== 'playing' || !room.target) throw new GameError('Du bist in dieser Runde schon fertig');
    return { run: player.run, goal: room.target, team: null, leg: null };
  }

  /** Wie activeRun, aber ohne Startzeit-Prüfung und ohne Fehler (für Angriffe und Anzeigen) */
  private runOf(room: Room, player: Player): ActiveRun | null {
    if (room.teams) {
      const team = this.teamOf(room, player.id);
      if (!team || team.status !== 'playing') return null;
      const leg = team.legs[team.active];
      if (leg.runnerId !== player.id) return null;
      return { run: leg.run, goal: leg.to, team, leg };
    }
    if (player.status !== 'playing' || !room.target) return null;
    return { run: player.run, goal: room.target, team: null, leg: null };
  }

  private isFrozen(player: Player) {
    return (player.effects.frozenUntil ?? 0) > this.now();
  }

  private async move(room: Room, player: Player, albumId: string, trackId: string, artistId: string) {
    if (room.phase !== 'playing') throw new GameError('Die Runde läuft gerade nicht');
    const { run, goal, team, leg } = this.activeRun(room, player);
    if (this.isFrozen(player)) throw new GameError('Du bist eingefroren!');
    if (run.busy) throw new GameError('Langsam – der letzte Klick wird noch geprüft');
    if (typeof albumId !== 'string' || typeof trackId !== 'string' || typeof artistId !== 'string') {
      throw new GameError('Ungültiger Zug');
    }

    run.busy = true;
    try {
      const current = run.stack[run.stack.length - 1];
      const depth = run.stack.length;
      if (!current) throw new GameError('Keine Position');

      // Server prüft: Steht der neue Artist wirklich auf einem Song mit dem aktuellen Artist?
      const album = await this.provider.getAlbum(albumId);
      const track = album.tracks.find((t) => t.id === trackId);
      if (!track) throw new GameError('Song nicht gefunden');
      const ids = track.artists.map((a) => a.id);
      if (!ids.includes(current.id)) {
        // Generalschlüssel: jeder Song eines Albums, auf dem der aktuelle Artist vorkommt
        const keyActive = room.settings.sabotage && (player.effects.keyUntil ?? 0) > this.now();
        const related = album.artists.some((a) => a.id === current.id) || album.tracks.some((t) => t.artists.some((a) => a.id === current.id));
        if (!keyActive || !related) throw new GameError(`${current.name} ist auf diesem Song nicht dabei`);
      }
      if (!ids.includes(artistId)) throw new GameError('Dieser Artist ist auf dem Song nicht dabei');
      if (artistId === current.id) throw new GameError('Da bist du schon');

      // Neue Artist-Seite schon laden, während wir die Antwort schicken
      this.warm(artistId);
      let artist: ArtistSummary;
      try {
        artist = await this.provider.getArtist(artistId);
      } catch {
        const ref = track.artists.find((a) => a.id === artistId)!;
        artist = { id: ref.id, name: ref.name, image: null, imageSmall: null, genres: [], url: null };
      }

      // Während wir gewartet haben, könnte sich einiges geändert haben
      if (room.phase !== 'playing' || !room.startAt) return;
      const still = this.runOf(room, player);
      if (!still || still.run !== run) return;
      if (run.stack.length !== depth || run.stack[depth - 1] !== current) throw new GameError('Zu spät – du wurdest zurückgespult');
      if (this.isFrozen(player)) throw new GameError('Du bist eingefroren!');

      const now = this.now();
      run.clicks++;
      run.stack.push(artist);
      run.path.push({
        artist,
        via: { trackId: track.id, trackName: track.name, albumId: album.id, albumName: album.name, cover: album.coverSmall ?? album.cover },
        back: false,
        atMs: now - room.startAt,
      });

      if (artist.id === goal.id) {
        if (team && leg) this.legDone(room, team, leg, player, now);
        else {
          player.status = 'finished';
          player.finishMs = now - room.startAt;
          player.place = room.players.filter((p) => p.status === 'finished').length;
          console.log(`[game] Lobby ${room.code}: ${player.name} ist im Ziel (Platz ${player.place})`);
          this.checkEnd(room);
        }
      } else if (room.settings.sabotage) {
        this.countJump(room, player);
      }
      this.broadcast(room);
    } finally {
      run.busy = false;
    }
  }

  /** Etappe geschafft: Stab übergeben oder das Team ist im Ziel */
  private legDone(room: Room, team: Team, leg: Leg, player: Player, now: number) {
    leg.endAt = now;
    const next = team.legs[leg.index + 1];
    if (!next) {
      team.status = 'finished';
      team.finishMs = team.legs.reduce((sum, l) => sum + ((l.endAt ?? 0) - (l.startAt ?? 0)), 0);
      team.place = room.teams!.filter((t) => t.status === 'finished').length;
      for (const p of room.players) {
        if (!team.members.includes(p.id)) continue;
        p.status = 'finished';
        p.place = team.place;
        p.finishMs = team.finishMs;
      }
      console.log(`[game] Lobby ${room.code}: ${TEAM_NAMES[team.id]} ist im Ziel (Platz ${team.place})`);
      this.checkEnd(room);
      return;
    }
    const startAt = now + this.handoverMs;
    next.startAt = startAt;
    next.run = newRun(leg.to, startAt - (room.startAt ?? startAt));
    team.active = next.index;
    // Übrige Items wandern mit dem Stab zum nächsten Läufer
    const nextRunner = room.players.find((p) => p.id === next.runnerId);
    if (nextRunner && nextRunner !== player) {
      nextRunner.items = [...nextRunner.items, ...player.items].slice(0, MAX_ITEMS);
      player.items = [];
      nextRunner.jumps = 0;
      next.runnerName = nextRunner.name;
      next.runnerColor = nextRunner.color;
    }
    this.warm(leg.to.id);
    this.fx(room, { kind: 'handover', team: team.id, from: player.id, to: next.runnerId, leg: next.index, at: leg.to, startAt });
  }

  private back(room: Room, player: Player) {
    if (room.phase !== 'playing') throw new GameError('Gerade nicht möglich');
    const { run } = this.activeRun(room, player);
    if (!room.settings.allowBack) throw new GameError('Zurück ist in dieser Runde ausgeschaltet');
    if (this.isFrozen(player)) throw new GameError('Du bist eingefroren!');
    if (run.busy) return;
    if (run.stack.length < 2 || !room.startAt) throw new GameError('Du bist schon am Start');
    run.stack.pop();
    const previous = run.stack[run.stack.length - 1];
    run.clicks++;
    run.path.push({ artist: previous, via: null, back: true, atMs: this.now() - room.startAt });
    this.broadcast(room);
  }

  private giveUp(room: Room, player: Player) {
    if (room.teams) {
      const team = this.teamOf(room, player.id);
      if (!team || team.status !== 'playing') return;
      if (team.legs[team.active].runnerId !== player.id) throw new GameError('Nur der aktive Läufer kann für das Team aufgeben');
      team.status = 'gaveup';
      for (const p of room.players) if (team.members.includes(p.id)) p.status = 'gaveup';
    } else {
      if (player.status !== 'playing') return;
      player.status = 'gaveup';
    }
    this.checkEnd(room);
    this.broadcast(room);
  }

  private checkEnd(room: Room) {
    if (room.phase !== 'playing' && room.phase !== 'countdown') return;
    if (!room.players.some((p) => p.status === 'playing')) this.endGame(room);
  }

  private endGame(room: Room) {
    if (room.phase === 'results' || room.phase === 'lobby') return;
    room.timers.forEach(clearTimeout);
    room.timers = [];
    room.phase = 'results';
    room.endedAt = this.now();
    for (const p of room.players) if (p.status === 'playing') p.status = 'timeout';
    for (const t of room.teams ?? []) if (t.status === 'playing') t.status = 'timeout';
    if (this.usage && room.usageAtStart !== null) {
      const used = this.usage.total - room.usageAtStart;
      const players = room.players.filter((p) => p.status !== 'idle').length;
      if (used >= 0) this.usage.recordRound(used, players);
      console.log(`[game] Lobby ${room.code}: Runde ${room.round} beendet – ${used} Spotify-Anfragen für ${players} Spieler`);
    } else {
      console.log(`[game] Lobby ${room.code}: Runde ${room.round} beendet`);
    }
    this.broadcast(room);
  }

  private backToLobby(room: Room) {
    room.timers.forEach(clearTimeout);
    room.timers = [];
    room.phase = 'lobby';
    room.startAt = null;
    room.endsAt = null;
    room.endedAt = null;
    room.teams = null;
    room.round++;
    for (const p of room.players) {
      p.ready = false;
      p.status = 'idle';
      p.run = newRun(null);
      p.finishMs = null;
      p.place = null;
      p.items = [];
      p.jumps = 0;
      p.effects = noEffects();
      p.peek = null;
      if (!p.socket && !p.disconnectTimer) {
        p.disconnectTimer = setTimeout(() => this.removePlayer(room, p), LOBBY_DISCONNECT_GRACE_MS);
      }
    }
    this.broadcast(room);
  }

  // ---------- Staffel: Übernehmen und Anfeuern ----------

  /** Ab wann ein Teamkollege den Lauf übernehmen darf (null = Läufer ist online) */
  private takeoverAt(room: Room, team: Team): number | null {
    if (team.status !== 'playing') return null;
    const leg = team.legs[team.active];
    const runner = room.players.find((p) => p.id === leg.runnerId);
    if (!runner) return 0;
    if (runner.socket) return null;
    return (runner.offlineSince ?? this.now()) + this.takeoverMs;
  }

  private takeover(room: Room, player: Player) {
    if (!room.teams || room.phase !== 'playing') throw new GameError('Übernehmen geht nur während einer Staffel');
    const team = this.teamOf(room, player.id);
    if (!team || team.status !== 'playing') throw new GameError('Dein Team läuft gerade nicht');
    const leg = team.legs[team.active];
    if (leg.runnerId === player.id) throw new GameError('Du bist doch schon dran');
    const at = this.takeoverAt(room, team);
    if (at === null || this.now() < at) throw new GameError('Übernehmen geht erst, wenn der Läufer 30 Sekunden weg ist');
    if (leg.run.busy) throw new GameError('Einen Moment – der letzte Klick wird noch geprüft');
    const old = room.players.find((p) => p.id === leg.runnerId);
    leg.runnerId = player.id;
    leg.runnerName = player.name;
    leg.runnerColor = player.color;
    if (old) {
      player.items = [...player.items, ...old.items].slice(0, MAX_ITEMS);
      old.items = [];
    }
    console.log(`[game] Lobby ${room.code}: ${player.name} übernimmt Etappe ${leg.index + 1} für ${TEAM_NAMES[team.id]}`);
    this.fx(room, { kind: 'takeover', team: team.id, by: player.id, from: old?.id ?? leg.runnerId });
    this.broadcast(room);
  }

  private cheer(room: Room, player: Player, sticker: CheerKind) {
    if (!room.teams || (room.phase !== 'playing' && room.phase !== 'countdown')) return;
    if (!CHEER_KINDS.includes(sticker)) return;
    const team = this.teamOf(room, player.id);
    if (!team) return;
    const now = this.now();
    if (now - player.cheerAt < CHEER_GAP_MS) return;
    player.cheerAt = now;
    const mates = room.players.filter((p) => team.members.includes(p.id));
    this.fx(room, { kind: 'cheer', team: team.id, by: player.id, sticker }, mates);
  }

  // ---------- Sabotage ----------

  /** Nach jedem 2. Sprung gibt es eine Kiste (solange im Inventar Platz ist) */
  private countJump(room: Room, player: Player) {
    player.jumps++;
    if (player.jumps < JUMPS_PER_CRATE) return;
    if (player.items.length >= MAX_ITEMS) {
      if (player.jumps === JUMPS_PER_CRATE) this.fx(room, { kind: 'crateFull', player: player.id }, [player]);
      return;
    }
    const item = this.rollItem(room, player);
    player.items.push(item);
    player.jumps = 0;
    this.fx(room, { kind: 'crate', player: player.id, item }, [player]);
  }

  private rollItem(room: Room, player: Player): ItemKind {
    if (this.itemSequence.length > 0) return this.itemSequence[this.itemPos++ % this.itemSequence.length];
    // Ohne mögliche Gegner (z. B. alleine üben) gibt es nur Items für einen selbst
    const hasOpponents = room.players.some((p) => this.validTarget(room, player, p));
    const pool = ITEM_KINDS.filter((k) => hasOpponents || !ATTACK_ITEMS.includes(k));
    const total = pool.reduce((s, k) => s + ITEM_WEIGHTS[k], 0);
    let r = this.random() * total;
    for (const k of pool) {
      r -= ITEM_WEIGHTS[k];
      if (r < 0) return k;
    }
    return pool[pool.length - 1];
  }

  /** Wen darf dieser Spieler angreifen? Klassisch: alle, die noch laufen. Staffel: nur den aktiven Läufer des anderen Teams. */
  private validTarget(room: Room, attacker: Player, target: Player): boolean {
    if (target.id === attacker.id) return false;
    if (room.teams) {
      const mine = this.teamOf(room, attacker.id);
      const theirs = this.teamOf(room, target.id);
      if (!mine || !theirs || mine === theirs || theirs.status !== 'playing') return false;
      return theirs.legs[theirs.active].runnerId === target.id;
    }
    return target.status === 'playing';
  }

  private async useItem(room: Room, player: Player, slot: number, targetId: string | undefined) {
    if (!room.settings.sabotage) throw new GameError('Sabotage ist in dieser Runde aus');
    if (room.phase !== 'playing') throw new GameError('Items gehen nur während der Runde');
    const mine = this.runOf(room, player);
    if (!mine) throw new GameError('Items kann nur benutzen, wer gerade läuft');
    const item = Number.isInteger(slot) ? player.items[slot] : undefined;
    if (!item) throw new GameError('In diesem Fach ist kein Item');
    const now = this.now();
    const active = (t: number | null) => (t ?? 0) > now;

    if (ATTACK_ITEMS.includes(item)) {
      if (now < player.attackReadyAt) throw new GameError(`Abklingzeit – noch ${Math.ceil((player.attackReadyAt - now) / 1000)} s`);
      const target = room.players.find((p) => p.id === targetId);
      if (!target || !this.validTarget(room, player, target)) throw new GameError('Diesen Spieler kannst du gerade nicht angreifen');
      if (item === 'freeze' && active(target.effects.frozenUntil)) throw new GameError(`${target.name} ist schon eingefroren`);
      if (item === 'ink' && active(target.effects.inkUntil)) throw new GameError(`${target.name} sieht schon nur Tinte`);
      const theirs = this.runOf(room, target);
      if (item === 'rewind' && (!theirs || theirs.run.stack.length < 2)) {
        throw new GameError(`${target.name} ist noch am Start – da gibt’s nichts zurückzuspulen`);
      }

      player.items.splice(slot, 1);
      player.attackReadyAt = now + ATTACK_COOLDOWN_MS;
      player.attacksSent++;
      if (active(target.effects.shieldUntil)) {
        target.effects.shieldUntil = null;
        this.fx(room, { kind: 'item', item, from: player.id, to: target.id, blocked: true });
      } else {
        if (item === 'freeze') target.effects.frozenUntil = now + ITEM_INFO.freeze.durationMs;
        if (item === 'ink') target.effects.inkUntil = now + ITEM_INFO.ink.durationMs;
        if (item === 'rewind' && theirs && room.startAt) {
          const run = theirs.run;
          run.stack.pop();
          run.path.push({ artist: run.stack[run.stack.length - 1], via: null, back: true, rewind: true, atMs: now - room.startAt });
        }
        player.attacksHit++;
        this.fx(room, { kind: 'item', item, from: player.id, to: target.id, blocked: false });
      }
      console.log(`[game] Lobby ${room.code}: ${player.name} → ${ITEM_INFO[item].name} → ${target.name}`);
      return this.broadcast(room);
    }

    // Items für einen selbst
    if (item === 'shield') {
      if (active(player.effects.shieldUntil)) throw new GameError('Dein Schild ist schon aktiv');
      player.items.splice(slot, 1);
      player.effects.shieldUntil = now + ITEM_INFO.shield.durationMs;
    } else if (item === 'key') {
      if (active(player.effects.keyUntil)) throw new GameError('Der Schlüssel ist schon aktiv');
      player.items.splice(slot, 1);
      player.effects.keyUntil = now + ITEM_INFO.key.durationMs;
    } else if (item === 'peek') {
      if (active(player.effects.peekUntil)) throw new GameError('Der Spickzettel liegt schon offen');
      player.items.splice(slot, 1);
      player.peek = await this.peekInfo(room, mine.goal);
      player.effects.peekUntil = this.now() + ITEM_INFO.peek.durationMs;
    }
    this.fx(room, { kind: 'item', item, from: player.id, to: null, blocked: false }, [player]);
    this.broadcast(room);
  }

  /** Spickzettel: Genres + 3 Cover des Ziels. Nutzt den Zwischenspeicher, höchstens 1 Abfrage pro Ziel und Runde. */
  private async peekInfo(room: Room, goal: ArtistSummary): Promise<PeekInfo> {
    const cached = room.peekCache.get(goal.id);
    if (cached) return cached;
    let covers: PeekInfo['covers'] = [];
    try {
      const sections = await this.provider.getInitialSections(goal.id);
      covers = [...sections.album.items, ...sections.appears_on.items]
        .slice(0, 3)
        .map((r) => ({ id: r.id, name: r.name, cover: r.coverSmall ?? r.cover }));
    } catch {
      /* dann eben nur die Genres */
    }
    const info: PeekInfo = { artist: goal, genres: goal.genres.slice(0, 4), covers };
    room.peekCache.set(goal.id, info);
    return info;
  }

  // ---------- Hilfsfunktionen ----------

  private roomOfSession(sessionId: string): Room | undefined {
    const code = this.sessionRoom.get(sessionId);
    return code ? this.rooms.get(code) : undefined;
  }

  private sweep() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      if (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        room.players.forEach((p) => this.sessionRoom.delete(p.sessionId));
        this.destroyRoom(room);
      }
    }
  }

  private stateFor(room: Room, viewer: Player): RoomState {
    const now = this.now();
    const results = room.phase === 'results';
    const showAll = room.settings.showOpponents || results;
    const viewerTeam = room.teams ? this.teamOf(room, viewer.id) : null;
    const relayView = !!room.teams || room.settings.mode === 'relay';
    const live = (t: number | null) => (t && t > now ? t : null);

    const players: PlayerPublic[] = room.players.map((p) => {
      let current: ArtistSummary | null = null;
      let clicks = p.run.clicks;
      if (room.teams) {
        const team = this.teamOf(room, p.id);
        clicks = team ? team.legs.filter((l) => l.runnerId === p.id).reduce((s, l) => s + l.run.clicks, 0) : 0;
        const leg = team?.legs[team.active];
        if (team && leg && team.status === 'playing' && leg.runnerId === p.id && (showAll || team === viewerTeam)) {
          current = leg.run.stack[leg.run.stack.length - 1] ?? null;
        }
      } else if (showAll || p.id === viewer.id) {
        current = p.run.stack[p.run.stack.length - 1] ?? null;
      }
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        isHost: p.id === room.hostId,
        ready: p.ready,
        connected: !!p.socket,
        status: p.status,
        clicks,
        current,
        finishMs: p.finishMs,
        place: p.place,
        path: results && !room.teams ? p.run.path : null,
        team: relayView ? (room.teams ? (this.teamOf(room, p.id)?.id ?? null) : p.team) : null,
        effects: {
          frozenUntil: live(p.effects.frozenUntil),
          inkUntil: live(p.effects.inkUntil),
          shieldUntil: live(p.effects.shieldUntil),
          keyUntil: live(p.effects.keyUntil),
          peekUntil: live(p.effects.peekUntil),
        },
        itemCount: p.items.length,
        attacksSent: p.attacksSent,
        attacksHit: p.attacksHit,
      };
    });

    let teams: TeamPublic[] | null = null;
    if (room.teams) {
      teams = room.teams.map((t) => {
        const own = t === viewerTeam || results;
        const legs: LegPublic[] = t.legs.map((l) => ({
          index: l.index,
          runnerId: l.runnerId,
          runnerName: l.runnerName,
          runnerColor: l.runnerColor,
          from: l.from,
          to: l.to,
          startAt: l.startAt,
          endAt: l.endAt,
          clicks: l.run.clicks,
          current: own || showAll ? (l.run.stack[l.run.stack.length - 1] ?? null) : null,
          path: own ? l.run.path : null,
        }));
        return {
          id: t.id,
          members: t.members,
          status: t.status,
          place: t.place,
          finishMs: t.finishMs,
          clicks: t.legs.reduce((s, l) => s + l.run.clicks, 0),
          active: t.active,
          legs,
          takeoverAt: t === viewerTeam ? this.takeoverAt(room, t) : null,
        };
      });
    } else if (room.settings.mode === 'relay') {
      teams = TEAM_IDS.map((id) => ({
        id,
        members: this.lobbyMembers(room, id).map((p) => p.id),
        status: 'idle',
        place: null,
        finishMs: null,
        clicks: 0,
        active: 0,
        legs: [],
        takeoverAt: null,
      }));
    }

    let yourPath = viewer.run.path;
    if (room.teams) {
      const leg = viewerTeam?.legs[viewerTeam.active];
      yourPath = viewerTeam && leg && leg.runnerId === viewer.id && viewerTeam.status === 'playing' ? leg.run.path : [];
    }

    return {
      code: room.code,
      phase: room.phase,
      you: viewer.id,
      players,
      start: room.start,
      target: room.target,
      checkpoints: room.checkpoints,
      settings: room.settings,
      startAt: room.startAt,
      endsAt: room.endsAt,
      endedAt: room.endedAt,
      serverNow: now,
      yourPath,
      round: room.round,
      teams,
      sabotage: room.settings.sabotage
        ? {
            items: viewer.items,
            crateIn: Math.max(0, JUMPS_PER_CRATE - viewer.jumps),
            attackReadyAt: viewer.attackReadyAt,
            peek: live(viewer.effects.peekUntil) ? viewer.peek : null,
          }
        : null,
    };
  }

  private broadcast(room: Room) {
    if (!this.rooms.has(room.code)) return;
    for (const p of room.players) {
      if (p.socket) this.send(p.socket, { t: 'state', state: this.stateFor(room, p) });
    }
  }

  /** Effekt-Ereignis für Animationen, Einblendungen und Sounds */
  private fx(room: Room, fx: FxEvent, to: Player[] = room.players) {
    for (const p of to) if (p.socket) this.send(p.socket, { t: 'fx', fx });
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
}
