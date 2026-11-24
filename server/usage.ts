import type { UsageInfo } from '../shared/types';
import type { KvClient } from './kv';

/**
 * Zählt die Anfragen an Spotify in den letzten 24 Stunden (stündliche Fächer – Spotify
 * zählt über ein rollendes Fenster, nicht ab Mitternacht), merkt sich, bei welchem Stand
 * Spotify zuletzt "Kontingent aufgebraucht" gemeldet hat, und misst, was eine Runde pro
 * Spieler im Schnitt kostet. Mit Key-Value-Speicher übersteht alles Neustarts.
 */

const HOUR_MS = 3600_000;
const BUCKET_TTL = 26 * 3600;
const K_LIMIT = 'sr:usage:lastLimit';
const K_ROUND = 'sr:usage:perPlayerRound';
const K_COOLDOWN = 'sr:spotify:cooldownUntil';
/**
 * Unter diesem Stand ist ein "Kontingent aufgebraucht" kein echtes Limit, sondern
 * eine noch laufende Sperre von vorher (z. B. nach einem Neustart) – nicht als Limit merken.
 */
const MIN_PLAUSIBLE_LIMIT = 100;

const hourNow = () => Math.floor(Date.now() / HOUR_MS);
const bucketKey = (h: number) => `sr:usage:h:${h}`;

export class UsageCounter {
  /** Stunde → Anzahl Anfragen */
  private buckets = new Map<number, number>();
  private pending = new Map<number, number>();
  private flushTimer: NodeJS.Timeout | null = null;
  private lastLimit: { count: number; at: number } | null = null;
  private perPlayerRound: number | null = null;
  /** Wächst nur – für die Messung einer Runde */
  private sinceStart = 0;
  private loaded: Promise<void>;

  constructor(private kv: KvClient | null) {
    this.loaded = this.load();
  }

  get persistent(): boolean {
    return !!this.kv;
  }

  private async load() {
    if (!this.kv) return;
    try {
      const now = hourNow();
      const hours = Array.from({ length: 24 }, (_, i) => now - i);
      const [limit, round, ...counts] = await Promise.all([
        this.kv.get(K_LIMIT),
        this.kv.get(K_ROUND),
        ...hours.map((h) => this.kv!.get(bucketKey(h))),
      ]);
      // Anfragen, die schon vor dem Laden gezählt wurden, kommen dazu
      let found = 0;
      hours.forEach((h, i) => {
        const n = Number(counts[i]?.toString() ?? 0) || 0;
        found += n;
        if (n > 0) this.buckets.set(h, (this.buckets.get(h) ?? 0) + n);
      });
      // Umstieg vom alten Tageszähler: dessen Stand einmalig übernehmen (liegt sicher in den letzten 24 h)
      if (found === 0) {
        const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
        const old = Number((await this.kv.get(`sr:usage:${day}`))?.toString() ?? 0) || 0;
        if (old > 0) {
          const h = now - 1;
          this.buckets.set(h, (this.buckets.get(h) ?? 0) + old);
          await this.kv.incrBy(bucketKey(h), old, BUCKET_TTL);
        }
      }
      if (limit) {
        const parsed = JSON.parse(limit.toString()) as { count: number; at: number };
        if (parsed.count >= MIN_PLAUSIBLE_LIMIT) this.lastLimit = parsed;
      }
      if (round) this.perPlayerRound = Number(round.toString()) || null;
    } catch {
      /* ohne Speicher zählen wir eben ab jetzt */
    }
  }

  /** Anfragen in den letzten 24 Stunden */
  private get last24(): number {
    const oldest = hourNow() - 23;
    let sum = 0;
    for (const [h, n] of this.buckets) {
      if (h >= oldest) sum += n;
      else this.buckets.delete(h);
    }
    return sum;
  }

  /** Eine Anfrage an Spotify ist rausgegangen */
  count(n = 1) {
    const h = hourNow();
    this.buckets.set(h, (this.buckets.get(h) ?? 0) + n);
    this.sinceStart += n;
    if (!this.kv) return;
    this.pending.set(h, (this.pending.get(h) ?? 0) + n);
    // Gesammelt alle 2 Sekunden speichern statt bei jeder Anfrage
    if (!this.flushTimer) this.flushTimer = setTimeout(() => void this.flush(), 2000);
  }

  /** Noch nicht gespeicherte Zählerstände wegschreiben (auch beim Herunterfahren) */
  async flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.kv || this.pending.size === 0) return;
    const batch = [...this.pending];
    this.pending.clear();
    for (const [h, n] of batch) {
      try {
        await this.kv.incrBy(bucketKey(h), n, BUCKET_TTL);
      } catch {
        this.pending.set(h, (this.pending.get(h) ?? 0) + n);
      }
    }
  }

  /** Spotify hat "Kontingent aufgebraucht" gemeldet */
  limitHit() {
    const used = this.last24;
    if (used < MIN_PLAUSIBLE_LIMIT) {
      console.warn(`[usage] Spotify-Sperre bei erst ${used} Anfragen – stammt von vorher, wird nicht als Limit gemerkt`);
      return;
    }
    this.lastLimit = { count: used, at: Date.now() };
    this.kv?.set(K_LIMIT, JSON.stringify(this.lastLimit), 60 * 24 * 3600).catch(() => {});
  }

  /** Zählerstand für die Rundenmessung (wächst nur) */
  get total(): number {
    return this.sinceStart;
  }

  /** Nach jeder Runde: Kosten pro Spieler als gleitender Mittelwert */
  recordRound(requests: number, players: number) {
    if (players <= 0 || requests <= 0) return;
    const perPlayer = requests / players;
    this.perPlayerRound = this.perPlayerRound === null ? perPlayer : this.perPlayerRound * 0.7 + perPlayer * 0.3;
    this.kv?.set(K_ROUND, String(Math.round(this.perPlayerRound * 10) / 10), 60 * 24 * 3600).catch(() => {});
  }

  async saveCooldown(until: number) {
    await this.kv?.set(K_COOLDOWN, String(until), Math.max(1, Math.ceil((until - Date.now()) / 1000))).catch(() => {});
  }

  async loadCooldown(): Promise<number> {
    if (!this.kv) return 0;
    try {
      return Number((await this.kv.get(K_COOLDOWN))?.toString() ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  async info(): Promise<UsageInfo> {
    await this.loaded;
    return {
      today: this.last24,
      lastLimit: this.lastLimit,
      perPlayerRound: this.perPlayerRound === null ? null : Math.round(this.perPlayerRound),
      persistent: this.persistent,
    };
  }
}
