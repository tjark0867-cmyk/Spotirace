import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib';

/** Zweite Speicherstufe außerhalb des Servers (z. B. Render Key Value) */
export interface RemoteStore {
  get(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer, ttlSeconds: number): Promise<void>;
}

/** Version der gespeicherten Daten – bei Formatänderungen hochzählen */
const REMOTE_PREFIX = 'sr:v1:';

/**
 * Kleiner In-Memory-Cache mit Ablaufzeit, LRU-Verdrängung und
 * Zusammenfassung gleichzeitiger Anfragen (wenn alle Spieler gleichzeitig
 * dieselbe Artist-Seite öffnen, geht nur EINE Anfrage an Spotify raus).
 * Optional mit zweiter Stufe (Key Value), die einen Neustart überlebt.
 */
export class TtlCache {
  private store = new Map<string, { value: unknown; expires: number }>();
  private inflight = new Map<string, Promise<unknown>>();
  /** Statistik für die Logs */
  stats = { memoryHits: 0, remoteHits: 0, loads: 0 };

  constructor(
    private maxEntries = 5000,
    private remote: RemoteStore | null = null,
  ) {}

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    // als "zuletzt benutzt" markieren
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value as T;
  }

  set(key: string, value: unknown, ttlMs: number) {
    this.store.delete(key);
    this.store.set(key, { value, expires: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /**
   * Holt einen Wert aus dem Speicher oder lädt ihn.
   * remoteTtlSeconds > 0: zusätzlich im Key-Value-Speicher ablegen bzw. von dort holen.
   */
  async wrap<T>(key: string, ttlMs: number, load: () => Promise<T>, remoteTtlSeconds = 0): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      this.stats.memoryHits++;
      return cached;
    }
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const useRemote = !!this.remote && remoteTtlSeconds > 0;
    const promise = (async () => {
      if (useRemote) {
        try {
          const buf = await this.remote!.get(REMOTE_PREFIX + key);
          if (buf) {
            const value = JSON.parse(brotliDecompressSync(buf).toString('utf8')) as T;
            this.stats.remoteHits++;
            return value;
          }
        } catch {
          /* Speicher weg oder kaputt → normal laden */
        }
      }
      const value = await load();
      this.stats.loads++;
      if (useRemote) {
        try {
          const packed = brotliCompressSync(Buffer.from(JSON.stringify(value)), {
            params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 },
          });
          this.remote!.set(REMOTE_PREFIX + key, packed, remoteTtlSeconds).catch(() => {});
        } catch {
          /* egal */
        }
      }
      return value;
    })()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  /** Wird dieser Eintrag gerade geladen? */
  pending(key: string): boolean {
    return this.inflight.has(key);
  }

  /** Direkt ablegen (Speicher + optional Key Value) */
  put(key: string, value: unknown, ttlMs: number, remoteTtlSeconds = 0) {
    this.set(key, value, ttlMs);
    if (this.remote && remoteTtlSeconds > 0) {
      try {
        const packed = brotliCompressSync(Buffer.from(JSON.stringify(value)), { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } });
        this.remote.set(REMOTE_PREFIX + key, packed, remoteTtlSeconds).catch(() => {});
      } catch {
        /* egal */
      }
    }
  }

  /** Nur nachsehen (Speicher, dann Key Value) – lädt nie etwas neu */
  async peek<T>(key: string, ttlMs: number): Promise<T | undefined> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    if (!this.remote) return undefined;
    try {
      const buf = await this.remote.get(REMOTE_PREFIX + key);
      if (!buf) return undefined;
      const value = JSON.parse(brotliDecompressSync(buf).toString('utf8')) as T;
      this.set(key, value, ttlMs);
      return value;
    } catch {
      return undefined;
    }
  }

  get size() {
    return this.store.size;
  }
}

/** Begrenzt, wie viele Anfragen gleichzeitig laufen. */
export class Limiter {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}
