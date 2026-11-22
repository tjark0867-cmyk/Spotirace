import { randomBytes, randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type {
  ArtistSummary,
  ClientMessage,
  GameSettings,
  PathStep,
  Phase,
  PlayerPublic,
  PlayerStatus,
  RoomState,
  ServerMessage,
  TimeLimit,
} from '../shared/types';
import type { MusicProvider } from './music/types';

const COUNTDOWN_MS = 3500;
const LOBBY_DISCONNECT_GRACE_MS = 45_000;
const HOST_DISCONNECT_GRACE_MS = 10_000;
const EMPTY_ROOM_TTL_MS = 10 * 60_000;
const MAX_PLAYERS = 12;

const COLORS = [
  '#1ed760', '#ff6437', '#509bf5', '#f573a0', '#ffc864', '#b49bc8',
  '#e8115b', '#27856a', '#ff4632', '#8d67ab', '#1e3264', '#e1118c',
];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Player {
  id: string;
  sessionId: string;
  name: string;
  color: string;
  ready: boolean;
  socket: WebSocket | null;
  status: PlayerStatus;
  clicks: number;
  path: PathStep[];
  /** Stapel der besuchten Artists für "Zurück" */
  stack: ArtistSummary[];
  finishMs: number | null;
  place: number | null;
  busy: boolean;
  disconnectTimer: NodeJS.Timeout | null;
}

interface Room {
  code: string;
  hostId: string;
  players: Player[];
  phase: Phase;
  start: ArtistSummary | null;
  target: ArtistSummary | null;
  settings: GameSettings;
  startAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
  round: number;
  timers: NodeJS.Timeout[];
  hostTimer: NodeJS.Timeout | null;
  emptySince: number | null;
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
    genres: Array.isArray(a.genres) ? a.genres.slice(0, 5).map((g) => String(g).slice(0, 50)) : [],
    url: typeof a.url === 'string' ? a.url.slice(0, 300) : null,
  };
}

export class GameServer {
  private rooms = new Map<string, Room>();
  /** sessionId → Raumcode */
  private sessionRoom = new Map<string, string>();
  /** sessionId → aktive Verbindung (auch ohne Raum) */
  private sessionSocket = new Map<string, WebSocket>();

  constructor(private provider: MusicProvider) {
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
        if (err instanceof GameError) {
          this.send(ws, msg.t === 'move' || msg.t === 'back' ? { t: 'moveFailed', message: err.message } : { t: 'error', message: err.message });
        } else {
          console.error('[game] Fehler:', err);
          const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
          this.send(ws, msg.t === 'move' ? { t: 'moveFailed', message } : { t: 'error', message });
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

      case 'setArtist': {
        hostOnly();
        lobbyOnly();
        const artist = msg.artist && isArtist(msg.artist) ? sanitizeArtist(msg.artist) : null;
        const other = msg.which === 'start' ? room.target : room.start;
        if (artist && other && other.id === artist.id) throw new GameError('Start und Ziel müssen verschiedene Artists sein');
        if (msg.which === 'start') room.start = artist;
        else room.target = artist;
        return this.broadcast(room);
      }

      case 'settings': {
        hostOnly();
        lobbyOnly();
        const s = msg.settings ?? {};
        if (s.timeLimitMin !== undefined && [0, 5, 10, 15].includes(s.timeLimitMin)) room.settings.timeLimitMin = s.timeLimitMin as TimeLimit;
        if (typeof s.allowBack === 'boolean') room.settings.allowBack = s.allowBack;
        if (typeof s.showOpponents === 'boolean') room.settings.showOpponents = s.showOpponents;
        return this.broadcast(room);
      }

      case 'ready':
        lobbyOnly();
        player.ready = !!msg.ready;
        return this.broadcast(room);

      case 'start':
        hostOnly();
        lobbyOnly();
        return this.startGame(room);

      case 'move':
        return this.move(room, player, msg.albumId, msg.trackId, msg.artistId);

      case 'back':
        return this.back(room, player);

      case 'giveUp':
        if (player.status !== 'playing') return;
        player.status = 'gaveup';
        this.checkEnd(room);
        return this.broadcast(room);

      case 'again':
        hostOnly();
        if (room.phase !== 'results') throw new GameError('Die Runde läuft noch');
        return this.backToLobby(room);
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
      settings: { timeLimitMin: 0, allowBack: true, showOpponents: true },
      startAt: null,
      endsAt: null,
      endedAt: null,
      round: 1,
      timers: [],
      hostTimer: null,
      emptySince: null,
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
      status: 'idle',
      clicks: 0,
      path: [],
      stack: [],
      finishMs: null,
      place: null,
      busy: false,
      disconnectTimer: null,
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

  // ---------- Spielablauf ----------

  private startGame(room: Room) {
    if (!room.start || !room.target) throw new GameError('Wähle zuerst Start- und Ziel-Artist');
    if (room.start.id === room.target.id) throw new GameError('Start und Ziel müssen verschiedene Artists sein');
    const notReady = room.players.filter((p) => p.socket && p.id !== room.hostId && !p.ready);
    if (notReady.length > 0) {
      throw new GameError(`Noch nicht bereit: ${notReady.map((p) => p.name).join(', ')}`);
    }

    const now = Date.now();
    room.phase = 'countdown';
    room.startAt = now + COUNTDOWN_MS;
    room.endsAt = room.settings.timeLimitMin > 0 ? room.startAt + room.settings.timeLimitMin * 60_000 : null;
    room.endedAt = null;

    for (const p of room.players) {
      p.clicks = 0;
      p.finishMs = null;
      p.place = null;
      p.busy = false;
      if (p.socket) {
        p.status = 'playing';
        p.path = [{ artist: room.start, via: null, back: false, atMs: 0 }];
        p.stack = [room.start];
      } else {
        // Offline-Spieler schauen diese Runde zu
        p.status = 'idle';
        p.path = [];
        p.stack = [];
      }
    }

    room.timers.push(
      setTimeout(() => {
        if (room.phase !== 'countdown') return;
        room.phase = 'playing';
        this.broadcast(room);
      }, COUNTDOWN_MS),
    );
    if (room.endsAt) {
      room.timers.push(setTimeout(() => this.endGame(room), room.endsAt - now));
    }
    console.log(`[game] Lobby ${room.code}: Runde ${room.round} startet (${room.start.name} → ${room.target.name})`);
    this.broadcast(room);
  }

  private async move(room: Room, player: Player, albumId: string, trackId: string, artistId: string) {
    if (room.phase !== 'playing') throw new GameError('Die Runde läuft gerade nicht');
    if (player.status !== 'playing') throw new GameError('Du bist in dieser Runde schon fertig');
    if (player.busy) throw new GameError('Langsam – der letzte Klick wird noch geprüft');
    if (typeof albumId !== 'string' || typeof trackId !== 'string' || typeof artistId !== 'string') {
      throw new GameError('Ungültiger Zug');
    }

    player.busy = true;
    try {
      const current = player.stack[player.stack.length - 1];
      if (!current) throw new GameError('Keine Position');

      // Server prüft: Steht der neue Artist wirklich auf einem Song mit dem aktuellen Artist?
      const album = await this.provider.getAlbum(albumId);
      const track = album.tracks.find((t) => t.id === trackId);
      if (!track) throw new GameError('Song nicht gefunden');
      const ids = track.artists.map((a) => a.id);
      if (!ids.includes(current.id)) throw new GameError(`${current.name} ist auf diesem Song nicht dabei`);
      if (!ids.includes(artistId)) throw new GameError('Dieser Artist ist auf dem Song nicht dabei');
      if (artistId === current.id) throw new GameError('Da bist du schon');

      let artist: ArtistSummary;
      try {
        artist = await this.provider.getArtist(artistId);
      } catch {
        const ref = track.artists.find((a) => a.id === artistId)!;
        artist = { id: ref.id, name: ref.name, image: null, genres: [], url: null };
      }

      // Während wir gewartet haben, könnte die Runde vorbei sein
      if (room.phase !== 'playing' || player.status !== 'playing' || !room.startAt) return;

      const now = Date.now();
      player.clicks++;
      player.stack.push(artist);
      player.path.push({
        artist,
        via: { trackId: track.id, trackName: track.name, albumId: album.id, albumName: album.name, cover: album.cover },
        back: false,
        atMs: now - room.startAt,
      });

      if (room.target && artist.id === room.target.id) {
        player.status = 'finished';
        player.finishMs = now - room.startAt;
        player.place = room.players.filter((p) => p.status === 'finished').length;
        console.log(`[game] Lobby ${room.code}: ${player.name} ist im Ziel (Platz ${player.place})`);
        this.checkEnd(room);
      }
      this.broadcast(room);
    } finally {
      player.busy = false;
    }
  }

  private back(room: Room, player: Player) {
    if (room.phase !== 'playing' || player.status !== 'playing') throw new GameError('Gerade nicht möglich');
    if (!room.settings.allowBack) throw new GameError('Zurück ist in dieser Runde ausgeschaltet');
    if (player.busy) return;
    if (player.stack.length < 2 || !room.startAt) throw new GameError('Du bist schon am Start');
    player.stack.pop();
    const previous = player.stack[player.stack.length - 1];
    player.clicks++;
    player.path.push({ artist: previous, via: null, back: true, atMs: Date.now() - room.startAt });
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
    room.endedAt = Date.now();
    for (const p of room.players) if (p.status === 'playing') p.status = 'timeout';
    console.log(`[game] Lobby ${room.code}: Runde ${room.round} beendet`);
    this.broadcast(room);
  }

  private backToLobby(room: Room) {
    room.timers.forEach(clearTimeout);
    room.timers = [];
    room.phase = 'lobby';
    room.startAt = null;
    room.endsAt = null;
    room.endedAt = null;
    room.round++;
    for (const p of room.players) {
      p.ready = false;
      p.status = 'idle';
      p.clicks = 0;
      p.path = [];
      p.stack = [];
      p.finishMs = null;
      p.place = null;
      if (!p.socket && !p.disconnectTimer) {
        p.disconnectTimer = setTimeout(() => this.removePlayer(room, p), LOBBY_DISCONNECT_GRACE_MS);
      }
    }
    this.broadcast(room);
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
    const showAll = room.settings.showOpponents || room.phase === 'results';
    const players: PlayerPublic[] = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isHost: p.id === room.hostId,
      ready: p.ready,
      connected: !!p.socket,
      status: p.status,
      clicks: p.clicks,
      current: showAll || p.id === viewer.id ? (p.stack[p.stack.length - 1] ?? null) : null,
      finishMs: p.finishMs,
      place: p.place,
      path: room.phase === 'results' ? p.path : null,
    }));
    return {
      code: room.code,
      phase: room.phase,
      you: viewer.id,
      players,
      start: room.start,
      target: room.target,
      settings: room.settings,
      startAt: room.startAt,
      endsAt: room.endsAt,
      endedAt: room.endedAt,
      serverNow: Date.now(),
      yourPath: viewer.path,
      round: room.round,
    };
  }

  private broadcast(room: Room) {
    if (!this.rooms.has(room.code)) return;
    for (const p of room.players) {
      if (p.socket) this.send(p.socket, { t: 'state', state: this.stateFor(room, p) });
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }
}
