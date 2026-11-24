import { useMemo } from 'react';
import type { ItemKind } from '../../../../shared/types';
import { Glow, seeded, shade, useSvgId } from './defs';
import { IceCrystal, InkBlot, ItemCrate, ItemIcon } from './Items';

/**
 * Effekt-Overlays für die Sabotage: Frost vom Bildschirmrand, Tinten-Spritzer,
 * Schild-Kuppel um den Avatar, aufgehende Item-Kiste.
 */

const f = (n: number) => Number(n.toFixed(1));

// ---------- Frost ----------

/** Eisblumen-Ranken: verzweigte Linien, nach Tiefe getrennt (dicke Äste, feine Nadeln) */
function buildFern(seed: number): string[] {
  const rand = seeded(seed);
  const byDepth: string[][] = [[], [], []];
  const grow = (x: number, y: number, angle: number, len: number, depth: number) => {
    const a = (angle * Math.PI) / 180;
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    byDepth[2 - depth].push(`M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}`);
    if (depth <= 0 || len < 3) return;
    const n = 3 + Math.floor(rand() * 2);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const bx = x + (x2 - x) * t;
      const by = y + (y2 - y) * t;
      const bl = len * (0.5 - t * 0.28) * (0.75 + rand() * 0.4);
      grow(bx, by, angle - 58 + (rand() - 0.5) * 14, bl, depth - 1);
      grow(bx, by, angle + 58 + (rand() - 0.5) * 14, bl, depth - 1);
    }
  };
  for (let i = 0; i < 6; i++) {
    grow(0, 0, 4 + i * 16 + (rand() - 0.5) * 8, 34 + rand() * 34, 2);
  }
  return byDepth.map((d) => d.join(''));
}

function FrostCorner({ seed, className }: { seed: number; className: string }) {
  const id = useSvgId('fc');
  const paths = useMemo(() => buildFern(seed), [seed]);
  return (
    <svg viewBox="0 0 100 100" className={`absolute h-[min(52vw,360px)] w-[min(52vw,360px)] ${className}`} aria-hidden>
      <defs>
        <radialGradient id={`${id}-bed`} cx="0" cy="0" r="1">
          <stop offset="0" stopColor="#e8faff" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#bfeeff" stopOpacity="0.45" />
          <stop offset="0.8" stopColor="#bfeeff" stopOpacity="0" />
        </radialGradient>
        <Glow id={`${id}-glow`} blur={0.8} color="#bfeeff" />
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-bed)`} />
      <g fill="none" stroke="#f4fdff" strokeLinecap="round" filter={`url(#${id}-glow)`}>
        <path d={paths[0]} strokeWidth="1.3" strokeOpacity="0.95" />
        <path d={paths[1]} strokeWidth="0.7" strokeOpacity="0.85" />
        <path d={paths[2]} strokeWidth="0.38" strokeOpacity="0.75" />
      </g>
    </svg>
  );
}

export function FrostOverlay({ secondsLeft }: { secondsLeft: number }) {
  const id = useSvgId('frost');
  return (
    <div className="fixed inset-0 z-40 animate-frost-in" aria-live="polite">
      {/* Eiskante rund um den Bildschirm */}
      <div className="absolute inset-0 shadow-[inset_0_0_90px_30px_rgba(190,236,255,.55),inset_0_0_24px_6px_rgba(255,255,255,.65)]" />
      <svg className="absolute inset-0 h-full w-full frost-noise" aria-hidden>
        <defs>
          <filter id={`${id}-n`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.011 0.018" numOctaves="4" seed="21" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.86  0 0 0 0 0.96  0 0 0 0 1  0 0 0 1.6 -0.55" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${id}-n)`} />
      </svg>
      <FrostCorner seed={3} className="left-0 top-0" />
      <FrostCorner seed={7} className="right-0 top-0 -scale-x-100" />
      <FrostCorner seed={11} className="bottom-0 left-0 -scale-y-100" />
      <FrostCorner seed={17} className="bottom-0 right-0 -scale-100" />
      {/* Klicks sind blockiert, solange man eingefroren ist */}
      <div className="absolute inset-0 grid place-items-center bg-[#bfeeff]/[0.07]">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#06263a]/75 px-7 py-5 text-center ring-1 ring-[#bfeeff]/50 backdrop-blur-sm">
          <IceCrystal size={84} className="animate-float" />
          <div className="text-2xl font-black tracking-tight text-[#e8faff]">Eingefroren!</div>
          <div className="text-sm font-semibold text-[#9fdcf5]">
            Noch <span className="tabular-nums">{secondsLeft}</span> s keine Klicks
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Tinte ----------

const SPLATS = [
  { cls: '-left-16 -top-14 rotate-[18deg]', size: 260 },
  { cls: '-right-20 top-[28%] rotate-[-34deg]', size: 230 },
  { cls: '-bottom-16 left-[18%] rotate-[120deg]', size: 240 },
  { cls: 'right-[12%] -bottom-24 rotate-[200deg]', size: 200 },
  { cls: 'left-[40%] top-[8%] rotate-[75deg]', size: 120 },
];

export function InkOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {SPLATS.map((s, i) => (
        <div key={i} className={`absolute animate-splat ${s.cls}`} style={{ animationDelay: `${i * 70}ms` }}>
          <InkBlot size={s.size} style={{ opacity: 0.93 }} />
        </div>
      ))}
    </div>
  );
}

/** Kleiner Klecks über einem Cover/Bild (Position und Drehung hängen von der ID ab) */
export function InkSmear({ seed }: { seed: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rot = h % 360;
  const x = 10 + (h % 40);
  const y = 8 + ((h >> 6) % 40);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#140d3a]/45" />
      <InkBlot lite size={200} className="absolute" style={{ width: '95%', height: '95%', left: `${x - 30}%`, top: `${y - 30}%`, transform: `rotate(${rot}deg)` }} />
    </div>
  );
}

// ---------- Schild-Kuppel ----------

export function ShieldDome({ size, color = '#509bf5' }: { size: number; color?: string }) {
  const id = useSvgId('dome');
  const d = size * 1.42;
  const light = shade(color, 0.55);
  return (
    <svg
      width={d}
      height={d}
      viewBox="0 0 100 100"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-dome"
      role="img"
      aria-label="Schild aktiv"
    >
      <defs>
        <radialGradient id={`${id}-g`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor={color} stopOpacity="0" />
          <stop offset="0.86" stopColor={color} stopOpacity="0.35" />
          <stop offset="0.97" stopColor={light} stopOpacity="0.85" />
          <stop offset="1" stopColor={light} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-hex`} width="10" height="17.32" patternUnits="userSpaceOnUse">
          <path d="M5 0 L10 2.89 L10 8.66 L5 11.55 L0 8.66 L0 2.89 Z M5 11.55 V17.32" fill="none" stroke={light} strokeWidth="0.6" />
        </pattern>
        <clipPath id={`${id}-c`}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-g)`} />
      <g clipPath={`url(#${id}-c)`} opacity="0.28">
        <rect width="100" height="100" fill={`url(#${id}-hex)`} />
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke={light} strokeWidth="1.6" strokeOpacity="0.9" />
      <path d="M18 36 A35 35 0 0 1 44 14" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.75" />
    </svg>
  );
}

// ---------- Item-Kiste geht auf ----------

export function CrateReveal({ item, color }: { item: ItemKind; color?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center" aria-live="polite">
      <div className="relative flex animate-crate-pop flex-col items-center">
        <div className="relative h-[170px] w-[170px]">
          <div className="absolute inset-0 animate-crate-shake">
            <ItemCrate size={170} open />
          </div>
          <div className="absolute left-1/2 top-[-6px] animate-item-rise">
            <ItemIcon kind={item} size={92} color={color} animate />
          </div>
        </div>
      </div>
    </div>
  );
}
