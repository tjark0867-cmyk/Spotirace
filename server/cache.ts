/**
 * Kleiner In-Memory-Cache mit Ablaufzeit, LRU-Verdrängung und
 * Zusammenfassung gleichzeitiger Anfragen (wenn alle Spieler gleichzeitig
 * dieselbe Artist-Seite öffnen, geht nur EINE Anfrage an Spotify raus).
 */
export class TtlCache {
  private store = new Map<string, { value: unknown; expires: number }>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private maxEntries = 5000) {}

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

  async wrap<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const promise = load()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
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
