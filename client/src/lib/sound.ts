/**
 * Soundeffekte – komplett im Browser synthetisiert (Web Audio), keine Dateien nötig.
 * Klangkette: Stimmen → Bus → (Hall) → Kompressor → Master.
 * Der Hall ist eine echte Faltung mit einer generierten Raumantwort, dadurch klingt
 * alles weich und "teuer" statt nach Piepsen.
 */

export type SoundName =
  | 'tap'
  | 'pick'
  | 'ready'
  | 'join'
  | 'leave'
  | 'countTick'
  | 'go'
  | 'open'
  | 'close'
  | 'jump'
  | 'back'
  | 'denied'
  | 'error'
  | 'opponentFinished'
  | 'win'
  | 'lose'
  | 'tick'
  | 'results'
  | 'found';

const STORAGE_KEY = 'spotirace.sound';
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Wave = OscillatorType;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private listeners = new Set<(on: boolean) => void>();
  enabled = true;

  constructor() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== '0';
    } catch {
      /* egal */
    }
    if (typeof window !== 'undefined') {
      // Browser erlauben Ton erst nach der ersten Berührung/Taste
      const unlock = () => {
        this.ensure();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchend', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      window.addEventListener('touchend', unlock);
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      /* egal */
    }
    this.listeners.forEach((l) => l(on));
    if (on) this.play('tap');
  }

  subscribe(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------- Aufbau ----------

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const AC: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AC) return null;
    try {
      const ctx = new AC({ latencyHint: 'interactive' });
      const bus = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      const master = ctx.createGain();
      master.gain.value = 0.95;

      // Hall-Weg: Hochpass (kein Matsch) → Faltungshall → leiser beimischen
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 350;
      const conv = ctx.createConvolver();
      conv.buffer = this.impulse(ctx, 2.2, 3.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.2;

      bus.connect(comp);
      bus.connect(hp);
      hp.connect(conv);
      conv.connect(wet);
      wet.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);

      this.ctx = ctx;
      this.bus = bus;
      // iOS: einmal Stille abspielen, damit der Ton freigeschaltet ist
      const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    } catch {
      return null;
    }
  }

  /** Stereo-Raumantwort: Rauschen mit exponentiellem Abklingen, leicht gefiltert */
  private impulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const white = Math.random() * 2 - 1;
        last = last * 0.6 + white * 0.4; // sanfter Tiefpass → wärmerer Hall
        data[i] = last * Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.008 ? i / (ctx.sampleRate * 0.008) : 1);
      }
    }
    return buf;
  }

  private noise(ctx: BaseAudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  private out(ctx: AudioContext, pan: number): AudioNode {
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(this.bus!);
      return p;
    }
    return this.bus!;
  }

  // ---------- Bausteine ----------

  private tone(
    t: number,
    freq: number,
    o: {
      type?: Wave;
      gain?: number;
      attack?: number;
      hold?: number;
      release?: number;
      to?: number;
      glide?: number;
      detune?: number;
      pan?: number;
      lowpass?: number;
      lowpassTo?: number;
    } = {},
  ) {
    const ctx = this.ctx!;
    const { type = 'sine', gain = 0.2, attack = 0.005, hold = 0, release = 0.3, to, glide = 0.08, detune = 0, pan = 0 } = o;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + glide);
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    let node: AudioNode = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 0.7;
      f.frequency.setValueAtTime(o.lowpass, t);
      if (o.lowpassTo) f.frequency.exponentialRampToValueAtTime(o.lowpassTo, t + attack + hold + release * 0.6);
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.out(ctx, pan));
    osc.start(t);
    osc.stop(t + attack + hold + release + 0.05);
  }

  private whoosh(t: number, dur: number, from: number, to: number, gain: number, q = 0.9, pan = 0) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.out(ctx, pan));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Gezupfter Ton: Dreieck + Oktave + kurzer Anschlag */
  private pluck(t: number, m: number, gain = 0.15, pan = 0, release = 0.45) {
    const f = midi(m);
    this.tone(t, f, { type: 'triangle', gain, attack: 0.004, release, lowpass: 5200, lowpassTo: 1400, pan });
    this.tone(t, f * 2, { type: 'sine', gain: gain * 0.35, attack: 0.003, release: release * 0.6, pan });
    this.whoosh(t, 0.025, 5000, 3000, gain * 0.25, 1.2, pan);
  }

  /** Glocke: unharmonische Teiltöne mit unterschiedlichem Abklingen */
  private bell(t: number, m: number, gain = 0.1, pan = 0) {
    const f = midi(m);
    const partials: Array<[number, number, number]> = [
      [1, 1, 1.6],
      [2.0, 0.45, 1.0],
      [2.76, 0.3, 0.7],
      [5.4, 0.12, 0.35],
    ];
    for (const [ratio, amp, dec] of partials) this.tone(t, f * ratio, { gain: gain * amp, attack: 0.002, release: dec, pan });
  }

  /** Marimba-artig: Grundton + 4. Teilton, sehr kurz */
  private mallet(t: number, m: number, gain = 0.22, release = 0.45) {
    const f = midi(m);
    this.tone(t, f, { gain, attack: 0.003, release });
    this.tone(t, f * 3.99, { gain: gain * 0.18, attack: 0.002, release: 0.07 });
  }

  /** Weicher Akkord-Teppich */
  private pad(t: number, notes: number[], gain: number, hold: number, release: number, wave: Wave = 'sawtooth') {
    notes.forEach((m, i) => {
      const pan = (i / Math.max(1, notes.length - 1) - 0.5) * 0.5;
      for (const d of [-7, 7]) {
        this.tone(t, midi(m), { type: wave, gain: gain / 2, attack: 0.05, hold, release, detune: d, lowpass: 2600, lowpassTo: 900, pan });
      }
    });
  }

  // ---------- Öffentliche Sounds ----------

  play(name: SoundName) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.bus) return;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'tap':
        this.tone(t, 1500, { gain: 0.16, attack: 0.002, release: 0.06, to: 1100, glide: 0.04 });
        this.tone(t, 3000, { gain: 0.03, attack: 0.001, release: 0.025 });
        this.whoosh(t, 0.02, 6000, 4000, 0.05, 1.5);
        break;
      case 'pick':
        this.pluck(t, 76, 0.15, -0.15);
        this.pluck(t + 0.075, 83, 0.13, 0.15);
        break;
      case 'ready':
        [72, 76, 79].forEach((m, i) => this.pluck(t + i * 0.055, m, 0.12, (i - 1) * 0.2, 0.35));
        break;
      case 'join':
        this.tone(t, 480, { gain: 0.12, attack: 0.004, release: 0.12, to: 980, glide: 0.09 });
        this.pluck(t + 0.07, 81, 0.07);
        break;
      case 'leave':
        this.tone(t, 760, { gain: 0.09, attack: 0.004, release: 0.16, to: 340, glide: 0.14 });
        break;
      case 'countTick':
        this.mallet(t, 81, 0.26);
        break;
      case 'go': {
        this.whoosh(t, 0.4, 400, 6500, 0.09, 0.8);
        this.pad(t, [72, 76, 79, 84], 0.07, 0.25, 0.8);
        this.bell(t + 0.02, 96, 0.07);
        this.pluck(t, 60, 0.16, 0, 0.6);
        break;
      }
      case 'open':
        this.whoosh(t, 0.18, 700, 2600, 0.14, 0.8);
        this.tone(t, 300, { gain: 0.07, attack: 0.004, release: 0.1, to: 520, glide: 0.08 });
        break;
      case 'close':
        this.whoosh(t, 0.16, 2400, 700, 0.12, 0.8);
        this.tone(t, 520, { gain: 0.05, attack: 0.004, release: 0.09, to: 300, glide: 0.08 });
        break;
      case 'jump':
        this.whoosh(t, 0.3, 380, 4800, 0.085, 0.9);
        this.pluck(t + 0.13, 79, 0.13, -0.2);
        this.pluck(t + 0.2, 86, 0.12, 0.2, 0.6);
        break;
      case 'back':
        this.whoosh(t, 0.26, 4200, 500, 0.07, 0.9);
        this.pluck(t + 0.1, 86, 0.1, 0.2);
        this.pluck(t + 0.17, 79, 0.1, -0.2);
        break;
      case 'denied':
        this.tone(t, 150, { type: 'square', gain: 0.1, attack: 0.004, release: 0.1, to: 115, glide: 0.08, lowpass: 900 });
        this.tone(t + 0.1, 150, { type: 'square', gain: 0.1, attack: 0.004, release: 0.12, to: 110, glide: 0.1, lowpass: 900 });
        break;
      case 'error':
        this.pluck(t, 69, 0.11, 0, 0.3);
        this.pluck(t + 0.11, 64, 0.11, 0, 0.4);
        break;
      case 'opponentFinished':
        this.bell(t, 88, 0.1, -0.2);
        this.bell(t + 0.13, 95, 0.07, 0.2);
        break;
      case 'win': {
        [72, 76, 79, 84, 88].forEach((m, i) => this.pluck(t + i * 0.075, m, 0.15, (i - 2) * 0.15, 0.5));
        const s = t + 0.42;
        this.pad(s, [60, 67, 72, 76], 0.05, 0.5, 1.6);
        this.bell(s, 96, 0.08);
        this.bell(s + 0.18, 100, 0.05, 0.3);
        this.whoosh(s, 0.9, 6000, 9000, 0.02, 0.5);
        break;
      }
      case 'lose':
        [69, 65, 62].forEach((m, i) => this.pluck(t + i * 0.13, m, 0.11, 0, 0.6));
        break;
      case 'tick':
        this.mallet(t, 88, 0.11, 0.12);
        break;
      case 'found':
        // Funkeln: Ziel ist im geöffneten Album
        [84, 88, 91, 96].forEach((m, i) => this.bell(t + i * 0.07, m, 0.075, (i - 1.5) * 0.2));
        this.whoosh(t, 0.5, 3000, 8000, 0.025, 0.6);
        break;
      case 'results':
        this.whoosh(t, 0.7, 200, 1400, 0.045, 0.7);
        this.pad(t + 0.05, [65, 69, 72], 0.045, 0.35, 1.1, 'triangle');
        this.bell(t + 0.45, 84, 0.08);
        break;
    }
  }
}

export const sound = new SoundEngine();
