import net from 'node:net';
import tls from 'node:tls';

/**
 * Winziger Redis-/Key-Value-Client ohne Zusatzpaket (RESP2-Protokoll).
 * Kann genau das, was Spotirace braucht: GET, SET mit Ablaufzeit, INCRBY, EXPIRE.
 * Fällt der Speicher aus, liefern alle Befehle einfach "nichts" – das Spiel läuft weiter.
 */

type Reply = string | number | Buffer | null | Reply[] | Error;

interface Pending {
  resolve: (v: Reply) => void;
  reject: (e: Error) => void;
  done: boolean;
}

const CRLF = Buffer.from('\r\n');

function encode(args: Array<string | Buffer | number>): Buffer {
  const parts: Buffer[] = [Buffer.from(`*${args.length}\r\n`)];
  for (const a of args) {
    const b = Buffer.isBuffer(a) ? a : Buffer.from(String(a));
    parts.push(Buffer.from(`$${b.length}\r\n`), b, CRLF);
  }
  return Buffer.concat(parts);
}

/** Liest eine Antwort ab `pos`. Gibt null zurück, wenn noch Daten fehlen. */
function parse(buf: Buffer, pos: number): { value: Reply; end: number } | null {
  if (pos >= buf.length) return null;
  const lineEnd = buf.indexOf(CRLF, pos);
  if (lineEnd === -1) return null;
  const type = String.fromCharCode(buf[pos]);
  const line = buf.toString('utf8', pos + 1, lineEnd);
  const next = lineEnd + 2;
  switch (type) {
    case '+':
      return { value: line, end: next };
    case '-':
      return { value: new Error(line), end: next };
    case ':':
      return { value: Number(line), end: next };
    case '$': {
      const len = Number(line);
      if (len < 0) return { value: null, end: next };
      if (buf.length < next + len + 2) return null;
      return { value: buf.subarray(next, next + len), end: next + len + 2 };
    }
    case '*': {
      const count = Number(line);
      if (count < 0) return { value: null, end: next };
      const items: Reply[] = [];
      let p = next;
      for (let i = 0; i < count; i++) {
        const r = parse(buf, p);
        if (!r) return null;
        items.push(r.value);
        p = r.end;
      }
      return { value: items, end: p };
    }
    default:
      throw new Error(`Unbekannte Antwort vom Key-Value-Speicher: ${type}`);
  }
}

export class KvClient {
  private socket: net.Socket | null = null;
  private connecting: Promise<net.Socket> | null = null;
  private queue: Pending[] = [];
  private buffer: Buffer = Buffer.alloc(0);
  private lastFailure = 0;
  private url: URL;

  constructor(
    connectionString: string,
    private timeoutMs = 800,
  ) {
    this.url = new URL(connectionString);
  }

  /** Für Logs: Adresse ohne Passwort */
  get label(): string {
    return `${this.url.protocol}//${this.url.hostname}:${this.url.port || 6379}`;
  }

  private fail(err: Error) {
    for (const p of this.queue) if (!p.done) ((p.done = true), p.reject(err));
    this.queue = [];
    this.buffer = Buffer.alloc(0);
    this.socket?.destroy();
    this.socket = null;
  }

  private onData(chunk: Buffer) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    let pos = 0;
    for (;;) {
      let r: ReturnType<typeof parse>;
      try {
        r = parse(this.buffer, pos);
      } catch (err) {
        this.fail(err as Error);
        return;
      }
      if (!r) break;
      pos = r.end;
      const p = this.queue.shift();
      if (p && !p.done) {
        p.done = true;
        if (r.value instanceof Error) p.reject(r.value);
        else p.resolve(r.value);
      }
    }
    this.buffer = pos >= this.buffer.length ? Buffer.alloc(0) : this.buffer.subarray(pos);
  }

  private async connect(): Promise<net.Socket> {
    if (this.socket && !this.socket.destroyed) return this.socket;
    if (this.connecting) return this.connecting;
    // Nach einem Fehler nicht im Sekundentakt neu verbinden
    if (Date.now() - this.lastFailure < 5000) throw new Error('Key-Value-Speicher gerade nicht erreichbar');

    this.connecting = new Promise<net.Socket>((resolve, reject) => {
      const host = this.url.hostname;
      const port = Number(this.url.port) || 6379;
      const sock =
        this.url.protocol === 'rediss:'
          ? tls.connect({ host, port, servername: host })
          : net.connect({ host, port });
      const timer = setTimeout(() => sock.destroy(new Error('Verbindung zum Key-Value-Speicher dauert zu lange')), 3000);
      sock.setNoDelay(true);
      sock.once(this.url.protocol === 'rediss:' ? 'secureConnect' : 'connect', () => {
        clearTimeout(timer);
        resolve(sock);
      });
      sock.on('data', (c: Buffer) => this.onData(c));
      sock.on('error', (err) => {
        clearTimeout(timer);
        this.lastFailure = Date.now();
        reject(err);
        this.fail(err);
      });
      sock.on('close', () => {
        if (this.socket === sock) this.fail(new Error('Verbindung zum Key-Value-Speicher getrennt'));
      });
    })
      .then(async (sock) => {
        this.socket = sock;
        const user = decodeURIComponent(this.url.username);
        const pass = decodeURIComponent(this.url.password);
        if (pass) await this.send(user ? ['AUTH', user, pass] : ['AUTH', pass]);
        const db = Number(this.url.pathname.replace('/', ''));
        if (db > 0) await this.send(['SELECT', db]);
        return sock;
      })
      .finally(() => {
        this.connecting = null;
      });
    return this.connecting;
  }

  private send(args: Array<string | Buffer | number>): Promise<Reply> {
    const sock = this.socket;
    if (!sock) return Promise.reject(new Error('Nicht verbunden'));
    return new Promise<Reply>((resolve, reject) => {
      const entry: Pending = { resolve, reject, done: false };
      this.queue.push(entry);
      // Bei Zeitüberschreitung bleibt der Eintrag in der Warteschlange,
      // damit die verspätete Antwort nicht beim nächsten Befehl landet.
      setTimeout(() => {
        if (!entry.done) {
          entry.done = true;
          reject(new Error('Key-Value-Speicher antwortet nicht'));
        }
      }, this.timeoutMs);
      sock.write(encode(args));
    });
  }

  async command(args: Array<string | Buffer | number>): Promise<Reply> {
    await this.connect();
    return this.send(args);
  }

  async get(key: string): Promise<Buffer | null> {
    const r = await this.command(['GET', key]);
    return Buffer.isBuffer(r) ? r : null;
  }

  async set(key: string, value: Buffer | string, ttlSeconds: number): Promise<void> {
    await this.command(['SET', key, value, 'EX', Math.max(1, Math.round(ttlSeconds))]);
  }

  async incrBy(key: string, by: number, ttlSeconds?: number): Promise<number> {
    const n = Number(await this.command(['INCRBY', key, by]));
    if (ttlSeconds) await this.command(['EXPIRE', key, ttlSeconds]);
    return n;
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.command(['PING'])) === 'PONG';
    } catch {
      return false;
    }
  }

  close() {
    this.fail(new Error('geschlossen'));
  }
}
