import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ClientMessage, PlayerPublic, RoomState, ServerMessage } from '../../../shared/types';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error' | 'success';
}

function randomId(): string {
  // crypto.randomUUID gibt es nur auf HTTPS/localhost – im WLAN (http://192.168…) nicht
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* Fallback unten */
    }
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** Pro Browser-Tab eine eigene Sitzung, die einen Reload übersteht */
function getSessionId(): string {
  const KEY = 'spotirace.session';
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const id = randomId();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return randomId();
  }
}

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting';

export function useGameConnection() {
  const [state, setState] = useState<RoomState | null>(null);
  const [inRoom, setInRoom] = useState<boolean | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingMove, setPendingMove] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const offsetRef = useRef(0);
  const pathLenRef = useRef(0);
  const sessionId = useRef(getSessionId());
  const toastId = useRef(0);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 4500 : 3200);
  }, []);

  useEffect(() => {
    let closedByUs = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setConnection('open');
        ws.send(JSON.stringify({ t: 'hello', sessionId: sessionId.current } satisfies ClientMessage));
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'ping' }));
        }, 20_000);
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        switch (msg.t) {
          case 'state': {
            offsetRef.current = msg.state.serverNow - Date.now();
            const len = msg.state.yourPath.length;
            if (len !== pathLenRef.current || msg.state.phase !== 'playing') setPendingMove(null);
            pathLenRef.current = len;
            setState(msg.state);
            setInRoom(true);
            break;
          }
          case 'noRoom':
            setState(null);
            setInRoom(false);
            setPendingMove(null);
            break;
          case 'moveFailed':
            setPendingMove(null);
            toast(msg.message, 'error');
            break;
          case 'error':
            toast(msg.message, 'error');
            break;
        }
      };

      ws.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (closedByUs) return;
        setConnection('reconnecting');
        retry++;
        retryTimer = setTimeout(connect, Math.min(5000, 500 * 2 ** Math.min(retry, 4)));
      };
    };

    connect();
    return () => {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, [toast]);

  const send = useCallback(
    (msg: ClientMessage) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        return true;
      }
      toast('Keine Verbindung zum Server – versuche es gleich nochmal', 'error');
      return false;
    },
    [toast],
  );

  const move = useCallback(
    (albumId: string, trackId: string, artistId: string) => {
      if (pendingMove) return;
      if (send({ t: 'move', albumId, trackId, artistId })) setPendingMove(artistId);
    },
    [send, pendingMove],
  );

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const me: PlayerPublic | null = state?.players.find((p) => p.id === state.you) ?? null;

  return { state, me, inRoom, connection, toasts, toast, send, move, pendingMove, serverNow };
}

export type GameApi = ReturnType<typeof useGameConnection>;

export const GameContext = createContext<GameApi | null>(null);

export function useGame(): GameApi {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame außerhalb von GameContext');
  return ctx;
}

/** Aktuelle Serverzeit, regelmäßig aktualisiert */
export function useServerNow(intervalMs = 250): number {
  const { serverNow } = useGame();
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [serverNow, intervalMs]);
  return now;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* Fallback unten */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
