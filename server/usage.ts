import type { UsageInfo } from '../shared/types';
import type { KvClient } from './kv';

/**
 * Zählt, wie viele Anfragen heute an Spotify gegangen sind, merkt sich, bei welchem
 * Stand Spotify zuletzt "Kontingent aufgebraucht" gemeldet hat, und misst, was eine
 * Runde pro Spieler im Schnitt kostet. Mit Key-Value-Speicher übersteht alles Neustarts.
 */

const DAY_TTL = 3 * 24 * 3600;
const K_LIMIT = 'sr:usage:lastLimit';
const K_ROUND = 'sr:usage:perPlayerRound';
const K_COOLDOWN = 'sr:spotify:cooldownUntil';
/**
 * Unter diesem Stand ist ein "Kontingent aufgebraucht" kein echtes Limit, sondern
 * eine noch laufende Sperre von vorher (z. B. nach einem Neustart) – nicht als Limit merken.
 */
const MIN_PLAUSIBLE_LIMIT = 100;

function berlinDay(d = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d); // JJJJ-MM-TT
}

export class UsageCounter {
  private day = berlinDay();
  private local = 0; // Stand heute (inkl. noch nicht gespeicherter Anfragen)
  private pending = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private lastLimit: { count: number; at: number } | null = null;
  private perPlayerRound: number | null = null;
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
      const [today, limit, round] = await Promise.all([
        this.kv.get(`sr:usage:${this.day}`),
        this.kv.get(K_LIMIT),
        this.kv.get(K_ROUND),
      ]);
      // Anfragen, die schon vor dem Laden gezählt wurden, kommen dazu
      this.local += Number(today?.toString() ?? 0) || 0;
      if (limit) {
        const parsed = JSON.parse(limit.toString()) as { count: number; at: number };
        if (parsed.count >= MIN_PLAUSIBLE_LIMIT) this.lastLimit = parsed;
      }
      if (round) this.perPlayerRound = Number(round.toString()) || null;
    } catch {
      /* ohne Speicher zählen wir eben ab jetzt */
    }
  }

  private rollDay() {
    const d = berlinDay();
    if (d !== this.day) {
      this.day = d;
      this.local = 0;
      this.pending = 0;
    }
  }

  /** Eine Anfrage an Spotify ist rausgegangen */
  count(n = 1) {
    this.rollDay();
    this.local += n;
    if (!this.kv) return;
    this.pending += n;
    // Gesammelt alle 2 Sekunden speichern statt bei jeder Anfrage
    if (!this.flushTimer) this.flushTimer = setTimeout(() => void this.flush(), 2000);
  }

  /** Noch nicht gespeicherte Zählerstände wegschreiben (auch beim Herunterfahren) */
  async flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const n = this.pending;
    if (!this.kv || n === 0) return;
    this.pending = 0;
    try {
      await this.kv.incrBy(`sr:usage:${this.day}`, n, DAY_TTL);
    } catch {
      this.pending += n;
    }
  }

  /** Spotify hat "Kontingent aufgebraucht" gemeldet */
  limitHit() {
    this.rollDay();
    if (this.local < MIN_PLAUSIBLE_LIMIT) {
      console.warn(`[usage] Spotify-Sperre bei erst ${this.local} Anfragen – stammt von vorher, wird nicht als Limit gemerkt`);
      return;
    }
    this.lastLimit = { count: this.local, at: Date.now() };
    this.kv?.set(K_LIMIT, JSON.stringify(this.lastLimit), 60 * 24 * 3600).catch(() => {});
  }

  /** Aktueller Zählerstand (für Rundenmessung) */
  get today(): number {
    this.rollDay();
    return this.local;
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
    this.rollDay();
    return {
      today: this.local,
      lastLimit: this.lastLimit,
      perPlayerRound: this.perPlayerRound === null ? null : Math.round(this.perPlayerRound),
      persistent: this.persistent,
    };
  }
}
