import type { CSSProperties } from 'react';
import type { ItemKind } from '../../../../shared/types';
import { Blur, Glow, Grain, WoodGrain, circlePath, shade, useSvgId } from './defs';

/**
 * Die Sabotage-Items – selbst gezeichnet, keine Emojis, keine Fremdbilder.
 * Alle Objekte in leichter Aufsicht (3/4-Ansicht) mit Materialstärke,
 * eine Lichtquelle oben links, Schlagschatten nach unten rechts.
 * viewBox 0 0 100 100, gestochen scharf von 24 bis 160 px.
 */

interface ArtProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** kleine Bewegung (Spulen drehen …) */
  animate?: boolean;
}

const f = (n: number) => Number(n.toFixed(2));
const line = (p: Array<[number, number]>) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');

/** Weicher Schatten auf dem Boden */
function GroundShadow({ id, cx, cy, rx, ry, opacity = 0.55 }: { id: string; cx: number; cy: number; rx: number; ry: number; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity={opacity} filter={`url(#${id})`} />;
}

// ---------- Eiskristall: Kristallsäulen wachsen aus Raureif ----------

interface Column {
  x: number;
  y: number;
  angle: number;
  len: number;
  w: number;
}

const COLUMNS: Column[] = [
  { x: 31, y: 82, angle: -60, len: 24, w: 4.8 },
  { x: 71, y: 82, angle: 58, len: 22, w: 4.6 },
  { x: 50, y: 80, angle: -4, len: 66, w: 10.5 },
  { x: 40, y: 83, angle: -31, len: 42, w: 7.6 },
  { x: 61, y: 83, angle: 26, len: 46, w: 8.2 },
];

function Crystal({ c, id }: { c: Column; id: string }) {
  const tip = c.w * 1.75;
  const body = c.len - tip;
  const a = -c.w;
  const b = -c.w * 0.28;
  const d = c.w * 0.36;
  const e = c.w;
  const apex = -c.w * 0.08;
  return (
    <g transform={`translate(${c.x} ${c.y}) rotate(${c.angle})`}>
      {/* drei sichtbare Seiten der sechseckigen Säule */}
      <path d={`M${a} 0L${b} 0L${b} ${-body}L${a} ${-body}Z`} fill={`url(#${id}-l)`} />
      <path d={`M${b} 0L${d} 0L${d} ${-body}L${b} ${-body}Z`} fill={`url(#${id}-f)`} />
      <path d={`M${d} 0L${e} 0L${e} ${-body}L${d} ${-body}Z`} fill={`url(#${id}-r)`} />
      {/* Spitze */}
      <path d={`M${a} ${-body}L${b} ${-body}L${apex} ${-c.len}Z`} fill="#f4fdff" />
      <path d={`M${b} ${-body}L${d} ${-body}L${apex} ${-c.len}Z`} fill={`url(#${id}-tf)`} />
      <path d={`M${d} ${-body}L${e} ${-body}L${apex} ${-c.len}Z`} fill={`url(#${id}-tr)`} />
      {/* Lichtbrechung im Inneren */}
      <path d={`M${f(b + (d - b) * 0.32)} -2L${f(b + (d - b) * 0.32)} ${f(-body * 0.86)}`} stroke="#fff" strokeOpacity="0.5" strokeWidth={f(c.w * 0.09)} />
      <path d={`M${f(a + (b - a) * 0.5)} ${f(-body * 0.25)}L${f(a + (b - a) * 0.5)} ${f(-body * 0.7)}`} stroke="#fff" strokeOpacity="0.35" strokeWidth={f(c.w * 0.06)} />
      {/* Kanten: hell zum Licht, dunkel davon weg */}
      <path d={`M${a} 0L${a} ${-body}L${apex} ${-c.len}`} fill="none" stroke="#ffffff" strokeWidth="0.7" strokeLinejoin="round" />
      <path d={`M${b} 0L${b} ${-body}L${apex} ${-c.len}`} fill="none" stroke="#e6fbff" strokeOpacity="0.8" strokeWidth="0.45" />
      <path d={`M${d} 0L${d} ${-body}`} fill="none" stroke="#bfefff" strokeOpacity="0.5" strokeWidth="0.4" />
      <path d={`M${e} 0L${e} ${-body}L${apex} ${-c.len}`} fill="none" stroke="#0a3a62" strokeOpacity="0.75" strokeWidth="0.6" strokeLinejoin="round" />
      <path d={`M${a} ${-body}L${e} ${-body}`} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.4" />
    </g>
  );
}

export function IceCrystal({ size = 64, className, style }: ArtProps) {
  const id = useSvgId('ice');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Eiskristall">
      <defs>
        <radialGradient id={`${id}-cold`} cx="0.5" cy="0.55" r="0.5">
          <stop offset="0" stopColor="#7fd8ff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#7fd8ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-l`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#9bdcf5" stopOpacity="0.92" />
          <stop offset="1" stopColor="#f2fcff" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${id}-f`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2f86bd" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#5fb9e6" stopOpacity="0.88" />
          <stop offset="1" stopColor="#b8ecff" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={`${id}-r`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#0d3f6b" stopOpacity="0.95" />
          <stop offset="1" stopColor="#2b7fb6" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}-tf`} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor="#8fd6f5" />
          <stop offset="1" stopColor="#dff7ff" />
        </linearGradient>
        <linearGradient id={`${id}-tr`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#1c5f93" />
          <stop offset="1" stopColor="#4aa3d6" />
        </linearGradient>
        <linearGradient id={`${id}-frost`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#d6f1fd" />
          <stop offset="1" stopColor="#7fb6d6" />
        </linearGradient>
        <Grain id={`${id}-snow`} freq={2.2} amount={0.5} seed={13} />
        <Blur id={`${id}-sh`} std={2.4} />
        <Blur id={`${id}-soft`} std={1} />
      </defs>
      <circle cx="50" cy="52" r="46" fill={`url(#${id}-cold)`} />
      <GroundShadow id={`${id}-sh`} cx={54} cy={90} rx={38} ry={5} />
      {COLUMNS.map((c, i) => (
        <Crystal key={i} c={c} id={id} />
      ))}
      {/* Raureif-Sockel, aus dem die Kristalle wachsen */}
      <path
        d="M13 87 C14 79 23 74 31 77 C35 71 44 70 50 74 C56 69 66 70 70 75 C78 72 88 77 87 87 C73 93 27 93 13 87 Z"
        fill={`url(#${id}-frost)`}
        filter={`url(#${id}-snow)`}
      />
      <path d="M18 88 C30 92 70 92 83 88 C80 91 66 93 50 93 C34 93 22 91 18 88 Z" fill="#3f7fa6" opacity="0.6" />
      <path d="M16 84 C19 78 26 76 31 78" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M38 75 C42 72 47 72 50 75" stroke="#fff" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
      <ellipse cx="57" cy="83" rx="9" ry="2.2" fill="#5d9fc6" opacity="0.35" filter={`url(#${id}-soft)`} />
    </svg>
  );
}

// ---------- Tinte: Tropfen schlägt ein, Krone spritzt hoch ----------

const SPLASH = (() => {
  const cx = 50;
  const cy = 69;
  const rx = 24;
  const ry = 7.5;
  const spikes = [3.45, 3.95, 4.5, 5.05, 5.6, 6.05, 0.35, 0.95, 1.6, 2.2, 2.75];
  const amps = [9, 13, 10, 14, 9, 7, 8, 12, 9, 13, 8];
  const h = (t: number) => {
    let v = 4;
    spikes.forEach((s, i) => {
      let dt = Math.abs(t - s);
      dt = Math.min(dt, Math.PI * 2 - dt);
      v += amps[i] * Math.exp(-((dt / 0.16) ** 2));
    });
    return v;
  };
  const wall = (from: number, to: number) => {
    const n = 64;
    const bottom: Array<[number, number]> = [];
    const top: Array<[number, number]> = [];
    for (let i = 0; i <= n; i++) {
      const t = from + ((to - from) * i) / n;
      const x = cx + rx * Math.cos(t);
      const y = cy + ry * Math.sin(t);
      bottom.push([x, y]);
      top.push([x, y - h(t)]);
    }
    return { fill: `${line([...bottom, ...[...top].reverse()])}Z`, rim: line(top) };
  };
  const drops = spikes.map((t, i) => ({
    x: cx + rx * Math.cos(t),
    y: cy + ry * Math.sin(t) - h(t) - 2.4,
    r: 1.6 + (amps[i] - 7) * 0.12,
    front: Math.sin(t) > 0,
  }));
  return { cx, cy, rx, ry, back: wall(Math.PI, Math.PI * 2), front: wall(0, Math.PI), drops };
})();

export function InkSplash({ size = 64, className, style }: ArtProps) {
  const id = useSvgId('spl');
  const s = SPLASH;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Tintenklecks">
      <defs>
        <radialGradient id={`${id}-pool`} cx="0.45" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#5a46d6" />
          <stop offset="0.6" stopColor="#2c1d86" />
          <stop offset="1" stopColor="#140c45" />
        </radialGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a78ff" />
          <stop offset="0.35" stopColor="#5340d0" />
          <stop offset="0.8" stopColor="#24167a" />
          <stop offset="1" stopColor="#3b2aa0" />
        </linearGradient>
        <linearGradient id={`${id}-back`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a2a9a" />
          <stop offset="0.5" stopColor="#6552dc" />
          <stop offset="1" stopColor="#2e2088" />
        </linearGradient>
        <radialGradient id={`${id}-drop`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#c9c0ff" />
          <stop offset="0.35" stopColor="#634fe0" />
          <stop offset="1" stopColor="#1d1260" />
        </radialGradient>
        <Blur id={`${id}-sh`} std={2.2} />
        <Blur id={`${id}-soft`} std={0.9} />
      </defs>
      <GroundShadow id={`${id}-sh`} cx={53} cy={82} rx={42} ry={8} opacity={0.6} />
      {/* Pfütze */}
      <path
        d="M9 77 C8 71 18 67 28 68 C34 64 44 66 50 66 C58 65 68 63 76 67 C86 66 94 71 92 77 C93 83 84 86 74 85 C66 89 52 88 44 87 C34 89 22 88 16 84 C10 83 8 80 9 77 Z"
        fill={`url(#${id}-pool)`}
      />
      <path d="M14 79 C22 85 40 87 52 86 C66 86 80 84 89 79" stroke="#8f7fff" strokeOpacity="0.55" strokeWidth="1" fill="none" strokeLinecap="round" />
      <ellipse cx="74" cy="71" rx="10" ry="1.8" fill="#b8adff" opacity="0.35" filter={`url(#${id}-soft)`} />
      {/* Krone: hintere Innenwand, Boden, vordere Außenwand */}
      <path d={s.back.fill} fill={`url(#${id}-back)`} />
      <ellipse cx={s.cx} cy={s.cy} rx={s.rx - 0.5} ry={s.ry - 0.4} fill="#120a3a" />
      <ellipse cx={s.cx - 4} cy={s.cy - 2} rx={10} ry={2} fill="#6c5cf0" opacity="0.35" filter={`url(#${id}-soft)`} />
      <path d={s.front.fill} fill={`url(#${id}-front)`} />
      <path d={s.front.rim} fill="none" stroke="#c2b8ff" strokeOpacity="0.85" strokeWidth="0.8" strokeLinejoin="round" />
      <path d={s.back.rim} fill="none" stroke="#8a7cf0" strokeOpacity="0.6" strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M31 70 C30.5 66 31.5 63 33.5 60" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {/* Tropfen an den Spitzen */}
      {s.drops.map((d, i) => (
        <g key={i} opacity={d.front ? 1 : 0.85}>
          <circle cx={f(d.x)} cy={f(d.y)} r={f(d.r)} fill={`url(#${id}-drop)`} />
          <circle cx={f(d.x - d.r * 0.35)} cy={f(d.y - d.r * 0.35)} r={f(d.r * 0.3)} fill="#fff" opacity="0.85" />
        </g>
      ))}
      {/* fallender Tropfen */}
      <path d="M50 9 C53 16 56 20 56 24 C56 28 53 31 50 31 C47 31 44 28 44 24 C44 20 47 16 50 9 Z" fill={`url(#${id}-drop)`} />
      <ellipse cx="47.6" cy="23.5" rx="1.4" ry="2.6" fill="#fff" opacity="0.8" />
      <path d="M50 2 V5.5 M46.5 4 V6.5 M53.5 4 V6.5" stroke="#a99bff" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
      {/* Spritzer daneben (mit Schatten auf dem Boden) */}
      {[
        [15, 59, 2.2],
        [86, 56, 1.9],
        [22, 50, 1.3],
        [80, 47, 1.2],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <ellipse cx={x + 3} cy={y + 18} rx={r} ry={r * 0.35} fill="#000" opacity="0.35" />
          <circle cx={x} cy={y} r={r} fill={`url(#${id}-drop)`} />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="#fff" opacity="0.8" />
        </g>
      ))}
    </svg>
  );
}

/** Tintenklecks von oben – für die verschmierten Cover und die Spritzer auf dem Bildschirm */
const INK_BLOB =
  'M50 13 C57 13 60 21 66 22 C74 23 79 16 86 22 C93 29 84 37 86 44 C88 51 96 54 93 62 C90 70 80 66 75 72 C70 78 75 88 64 90 C55 91 54 81 47 80 C40 79 36 89 27 85 C18 81 25 71 20 65 C15 59 5 58 7 49 C9 40 20 43 23 36 C26 29 18 22 25 16 C32 11 40 18 45 15 C47 14 48 13 50 13 Z';

export function InkBlot({ size = 64, className, style, lite = false }: ArtProps & { lite?: boolean }) {
  const id = useSvgId('ink');
  const drops: Array<[number, number, number]> = [
    [90, 13, 3.4],
    [11, 79, 2.8],
    [82, 89, 2.2],
    [8, 29, 2],
    [37, 6, 1.7],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Tintenklecks">
      <defs>
        <radialGradient id={`${id}-ink`} cx="0.42" cy="0.36" r="0.75">
          <stop offset="0" stopColor="#4a37b4" />
          <stop offset="0.5" stopColor="#24186a" />
          <stop offset="1" stopColor="#0d0829" />
        </radialGradient>
        <linearGradient id={`${id}-hi`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d2caff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#d2caff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-lo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.7" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={INK_BLOB} />
        </clipPath>
        <Blur id={`${id}-sh`} std={2} />
        <Blur id={`${id}-soft`} std={1.4} />
      </defs>
      {!lite && <path d={INK_BLOB} fill="#000" opacity="0.5" transform="translate(2.5 3.5)" filter={`url(#${id}-sh)`} />}
      {/* Dicke der Tinte */}
      <path d={INK_BLOB} fill="#06041a" transform="translate(0.8 1.6)" />
      <path d={INK_BLOB} fill={`url(#${id}-ink)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <path d={INK_BLOB} fill="none" stroke={`url(#${id}-hi)`} strokeWidth="4" />
        <path d={INK_BLOB} fill="none" stroke={`url(#${id}-lo)`} strokeWidth="5" />
      </g>
      {drops.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x + 0.5} cy={y + 0.9} r={r} fill="#06041a" />
          <circle cx={x} cy={y} r={r} fill={`url(#${id}-ink)`} />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="#fff" opacity="0.8" />
        </g>
      ))}
      <ellipse cx="38" cy="31" rx="12" ry="4.5" transform="rotate(-28 38 31)" fill="#fff" opacity={lite ? 0.25 : 0.45} filter={lite ? undefined : `url(#${id}-soft)`} />
      <ellipse cx="33" cy="34" rx="3.6" ry="1.6" transform="rotate(-28 33 34)" fill="#fff" opacity="0.85" />
    </svg>
  );
}

// ---------- Rückspul-Kassette (mit Bleistift in der Spule) ----------

function Reel({ cx, cy, tape, spin, id }: { cx: number; cy: number; tape: number; spin: boolean; id: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={tape} fill={`url(#${id}-tape)`} />
      {tape > 5 && <circle cx={cx} cy={cy} r={tape - 2} fill="none" stroke="#a7724c" strokeOpacity="0.35" strokeWidth="0.4" />}
      <circle cx={cx} cy={cy} r={tape - 0.6} fill="none" stroke="#c38a5d" strokeOpacity="0.4" strokeWidth="0.4" />
      <g>
        <circle cx={cx} cy={cy} r="3.3" fill={`url(#${id}-hub)`} />
        {[0, 60, 120, 180, 240, 300].map((r) => (
          <rect key={r} x={cx - 0.55} y={cy - 2.9} width="1.1" height="1.5" rx="0.3" fill="#3a2a20" transform={`rotate(${r} ${cx} ${cy})`} />
        ))}
        {spin && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`-360 ${cx} ${cy}`} dur="1.1s" repeatCount="indefinite" />}
      </g>
      <circle cx={cx} cy={cy} r="1.2" fill="#140c08" />
    </g>
  );
}

export function RewindCassette({ size = 64, className, style, animate = true }: ArtProps) {
  const id = useSvgId('cas');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Rückspul-Kassette">
      <defs>
        <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#ff8a5f" />
          <stop offset="0.45" stopColor="#e5532f" />
          <stop offset="1" stopColor="#a9321a" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffc2a8" />
          <stop offset="1" stopColor="#f08a64" />
        </linearGradient>
        <linearGradient id={`${id}-label`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#eadcbc" />
        </linearGradient>
        <linearGradient id={`${id}-window`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120c0a" />
          <stop offset="1" stopColor="#3a2c26" />
        </linearGradient>
        <radialGradient id={`${id}-tape`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#7a4a2a" />
          <stop offset="1" stopColor="#3a1f0f" />
        </radialGradient>
        <radialGradient id={`${id}-hub`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#bfc5cc" />
        </radialGradient>
        <radialGradient id={`${id}-screw`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#a9b2bb" />
          <stop offset="1" stopColor="#4c555e" />
        </radialGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.2" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-win`}>
          <rect x="31" y="42" width="34" height="13" rx="6.5" />
        </clipPath>
        <Grain id={`${id}-grain`} freq={1.8} amount={0.35} seed={8} />
        <Blur id={`${id}-sh`} std={2.4} />
        <Blur id={`${id}-soft`} std={1.1} />
      </defs>
      <GroundShadow id={`${id}-sh`} cx={55} cy={86} rx={40} ry={5.5} />
      <g transform="translate(50 52) rotate(-9) scale(0.9) translate(-50 -52)">
        {/* Gehäuse-Stärke: Oberkante und rechte Seite */}
        <path d="M13 28 L84 28 L89 23 L18 23 Z" fill={`url(#${id}-top)`} />
        <path d="M86 31 L91 26 L91 73 L86 78 Z" fill="#8a2812" />
        <path d="M84 28 L89 23 L91 26 L86 31 Z" fill="#c4512f" />
        {/* Vorderseite */}
        <rect x="9" y="27" width="78" height="52" rx="4" fill={`url(#${id}-shell)`} filter={`url(#${id}-grain)`} />
        <path d="M11 28.2 H85" stroke="#ffd0bc" strokeOpacity="0.8" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M9.6 30 V76" stroke="#ffb399" strokeOpacity="0.5" strokeWidth="0.7" />
        {/* Etikett */}
        <rect x="14" y="31.5" width="68" height="30" rx="2" fill={`url(#${id}-label)`} filter={`url(#${id}-grain)`} />
        <rect x="14" y="31.5" width="68" height="7" rx="2" fill="#2b2830" />
        <rect x="14" y="36.5" width="68" height="2" fill="#2b2830" />
        <path d="M24.5 33.2 L19.5 35 L24.5 36.8 Z M29.5 33.2 L24.5 35 L29.5 36.8 Z" fill="#ff7a52" />
        <path d="M34 35 q3 -1.6 6 0 t6 0 t6 0 t6 0" stroke="#e9e3ff" strokeOpacity="0.55" strokeWidth="0.7" fill="none" />
        <text x="22" y="54" textAnchor="middle" fontFamily="Figtree, Arial, sans-serif" fontWeight="900" fontSize="10" fill="#e5532f">
          A
        </text>
        <path d="M68 45 q2 -1.2 4 0 t4 0 M68 50 q2 -1.2 4 0 t4 0" stroke="#2c3e8f" strokeOpacity="0.7" strokeWidth="0.6" fill="none" />
        {/* Fenster mit Spulen: links fast voll, rechts fast leer → wird gerade zurückgespult */}
        <rect x="30.4" y="41.4" width="35.2" height="14.2" rx="7.1" fill="#d9c9a3" />
        <rect x="31" y="42" width="34" height="13" rx="6.5" fill={`url(#${id}-window)`} />
        <g clipPath={`url(#${id}-win)`}>
          <Reel cx={39.5} cy={48.5} tape={9.5} spin={animate} id={id} />
          <Reel cx={56.5} cy={48.5} tape={4.6} spin={animate} id={id} />
          <rect x="31" y="42" width="34" height="2.5" fill="#000" opacity="0.5" filter={`url(#${id}-soft)`} />
          <rect x="31" y="42" width="34" height="13" fill={`url(#${id}-glass)`} />
        </g>
        {/* Unterteil */}
        <path d="M25 79 L29 66.5 L67 66.5 L71 79 Z" fill="#b83a1d" />
        <path d="M29 66.5 L67 66.5" stroke="#ff9d7c" strokeOpacity="0.6" strokeWidth="0.7" />
        <circle cx="37" cy="73.5" r="2" fill="#2a0d05" />
        <circle cx="59" cy="73.5" r="2" fill="#2a0d05" />
        <rect x="44.5" y="71.5" width="3" height="3" rx="0.5" fill="#2a0d05" />
        <rect x="48.5" y="71.5" width="3" height="3" rx="0.5" fill="#2a0d05" />
        {[
          [12.5, 75],
          [83.5, 75],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x + 0.4} cy={y + 0.6} r="1.8" fill="#4a1508" />
            <circle cx={x} cy={y} r="1.7" fill={`url(#${id}-screw)`} />
            <path d={`M${x - 1.1} ${y + 0.3} L${x + 1.1} ${y - 0.3}`} stroke="#3b444c" strokeWidth="0.5" />
          </g>
        ))}
        {/* Bleistift in der rechten Spule – der Klassiker zum Zurückspulen */}
        <g transform="translate(56.5 48.5) rotate(-50)">
          <path d="M3 -3 L46 -3 L46 3 L3 3 Z" fill="#000" opacity="0.4" transform="translate(1 3.5)" filter={`url(#${id}-soft)`} />
          <path d="M0 0 L9 -3.1 L9 3.1 Z" fill="#e8c79a" />
          <path d="M0 0 L3 -1 L3 1 Z" fill="#2a2a2a" />
          <path d="M9 -3.1 L9 3.1 L7.2 2.2 L7.9 0 L7.2 -2.2 Z" fill="#c9a272" />
          <rect x="9" y="-3.1" width="33" height="2.1" fill="#ffe27a" />
          <rect x="9" y="-1" width="33" height="2" fill="#f5b800" />
          <rect x="9" y="1" width="33" height="2.1" fill="#c98a00" />
          <rect x="42" y="-3.1" width="5" height="6.2" fill="#c9d0d6" />
          <path d="M43.3 -3.1 V3.1 M45.6 -3.1 V3.1" stroke="#7d8790" strokeWidth="0.5" />
          <rect x="42" y="-3.1" width="5" height="1.5" fill="#fff" opacity="0.6" />
          <path d="M47 -3.1 H50 C51.3 -3.1 51.8 -1.6 51.8 0 C51.8 1.6 51.3 3.1 50 3.1 H47 Z" fill="#ff8fa3" />
          <path d="M47 -2.4 H50" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.6" />
        </g>
      </g>
    </svg>
  );
}

// ---------- Schild ----------

const SHIELD = 'M50 8 C62 13 74 14 86 12 C87 50 75 76 50 92 C25 76 13 50 14 12 C26 14 38 13 50 8 Z';
const FIELD = 'M50 16.5 C60 20.5 70 21.5 79 20.5 C79 50 69 70 50 83 C31 70 21 50 21 20.5 C30 21.5 40 20.5 50 16.5 Z';

export function ShieldArt({ size = 64, className, style, color = '#4f8fe8' }: ArtProps & { color?: string }) {
  const id = useSvgId('shd');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Schild">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#d5dce3" />
          <stop offset="0.65" stopColor="#8a959f" />
          <stop offset="1" stopColor="#5b656f" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(color, 0.25)} />
          <stop offset="0.42" stopColor={color} />
          <stop offset="0.82" stopColor={shade(color, -0.5)} />
          <stop offset="1" stopColor={shade(color, -0.3)} />
        </linearGradient>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-boss`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#dfe5ea" />
          <stop offset="0.7" stopColor="#7d8892" />
          <stop offset="1" stopColor="#3b434b" />
        </radialGradient>
        <clipPath id={`${id}-fclip`}>
          <path d={FIELD} />
        </clipPath>
        <clipPath id={`${id}-sclip`}>
          <path d={SHIELD} />
        </clipPath>
        <Grain id={`${id}-grain`} freq={1.7} amount={0.4} seed={3} />
        <Blur id={`${id}-sh`} std={2.4} />
        <Blur id={`${id}-in`} std={1.4} />
      </defs>
      <GroundShadow id={`${id}-sh`} cx={56} cy={93} rx={30} ry={4.5} />
      {/* Materialstärke (linke Kante, leicht gedreht) */}
      {[5, 4, 3, 2, 1].map((i) => (
        <path key={i} d={SHIELD} fill={i > 3 ? '#20262c' : '#3a4249'} transform={`translate(${-0.85 * i} ${0.75 * i})`} />
      ))}
      <path d={SHIELD} fill={`url(#${id}-rim)`} filter={`url(#${id}-grain)`} />
      <g clipPath={`url(#${id}-sclip)`}>
        <path d={SHIELD} fill="none" stroke={`url(#${id}-edge)`} strokeWidth="2.4" />
      </g>
      {/* Feld in Farbe, gewölbt */}
      <path d={FIELD} fill={`url(#${id}-field)`} filter={`url(#${id}-grain)`} />
      <path d={FIELD} fill={`url(#${id}-fade)`} />
      {/* Der Rand wirft Schatten aufs Feld */}
      <g clipPath={`url(#${id}-fclip)`}>
        <path d={`M-20 -20 H120 V120 H-20 Z ${FIELD}`} fillRule="evenodd" fill="#000" opacity="0.55" transform="translate(1.8 2.2)" filter={`url(#${id}-in)`} />
        {/* Mittelgrat */}
        <path d="M49.4 17 V83" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
        <path d="M50.6 17 V83" stroke="#000" strokeOpacity="0.25" strokeWidth="1" />
        {/* Kratzer */}
        <path d="M30 34 L38 30 M62 60 L69 56 M35 58 L40 62 M64 30 L60 34" stroke="#fff" strokeOpacity="0.28" strokeWidth="0.45" strokeLinecap="round" />
      </g>
      <path d={FIELD} fill="none" stroke="#2a3138" strokeWidth="0.9" />
      {/* Nieten */}
      {[
        [21, 15.5],
        [79, 15.5],
        [16.5, 42],
        [83.5, 42],
        [30, 74],
        [70, 74],
        [50, 88],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x + 0.6} cy={y + 0.8} r="1.8" fill="#000" opacity="0.45" />
          <circle cx={x} cy={y} r="1.7" fill={`url(#${id}-boss)`} />
        </g>
      ))}
      {/* Buckel mit Schatten */}
      <circle cx="52.6" cy="47.6" r="10.5" fill="#000" opacity="0.5" filter={`url(#${id}-in)`} />
      <circle cx="50" cy="44" r="10.5" fill={`url(#${id}-boss)`} />
      <circle cx="50" cy="44" r="10.5" fill="none" stroke="#2c3238" strokeWidth="0.8" />
      <circle cx="50" cy="44" r="7.5" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="0.6" />
      <ellipse cx="46" cy="40" rx="3.4" ry="2.3" transform="rotate(-35 46 40)" fill="#fff" opacity="0.9" />
    </svg>
  );
}

// ---------- Generalschlüssel (gold, mit Materialstärke) ----------

const KEY_PATH = [
  circlePath(26, 50, 17, true),
  circlePath(26, 50, 5.4, false),
  circlePath(15.4, 50, 2.3, false),
  circlePath(36.6, 50, 2.3, false),
  circlePath(26, 39.4, 2.3, false),
  circlePath(26, 60.6, 2.3, false),
  'M40.5 42.5 H46.5 V57.5 H40.5 Z',
  'M44 46.5 H88 V53.5 H44 Z',
  'M50 44 H53.5 V56 H50 Z',
  'M70 53 H86 V67 H81 V61.5 H77 V69 H72 V61.5 H70 Z',
  circlePath(88, 50, 3.6, true),
].join(' ');

export function MasterKey({ size = 64, className, style }: ArtProps) {
  const id = useSvgId('key');
  const rot = 'rotate(-38 50 50)';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Generalschlüssel">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#fff3b8" />
          <stop offset="0.25" stopColor="#ffd24a" />
          <stop offset="0.55" stopColor="#d89412" />
          <stop offset="0.8" stopColor="#9c6206" />
          <stop offset="1" stopColor="#e6b03a" />
        </linearGradient>
        <linearGradient id={`${id}-hi`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffbe6" stopOpacity="1" />
          <stop offset="0.4" stopColor="#fffbe6" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={KEY_PATH} transform={rot} />
        </clipPath>
        <Grain id={`${id}-grain`} freq={1.7} amount={0.45} seed={7} />
        <Blur id={`${id}-sh`} std={2.2} />
      </defs>
      {/* Schatten auf dem Boden */}
      <g transform="translate(4 8)" filter={`url(#${id}-sh)`} opacity="0.55">
        <path d={KEY_PATH} transform={rot} fill="#000" />
      </g>
      {/* Materialstärke */}
      {[6, 5, 4, 3, 2, 1].map((i) => (
        <g key={i} transform={`translate(${0.4 * i} ${0.7 * i})`}>
          <path d={KEY_PATH} transform={rot} fill={i > 3 ? '#4a2e00' : '#7a4c04'} />
        </g>
      ))}
      <path d={KEY_PATH} transform={rot} fill={`url(#${id}-gold)`} filter={`url(#${id}-grain)`} />
      {/* Fase: Licht oben links, Schatten unten rechts */}
      <g clipPath={`url(#${id}-clip)`}>
        <g transform="translate(-0.9 -0.9)">
          <path d={KEY_PATH} transform={rot} fill="none" stroke={`url(#${id}-hi)`} strokeWidth="1.6" />
        </g>
        <g transform="translate(0.9 0.9)">
          <path d={KEY_PATH} transform={rot} fill="none" stroke="#5c3a03" strokeOpacity="0.55" strokeWidth="1.2" />
        </g>
      </g>
      <path d={KEY_PATH} transform={rot} fill="none" stroke="#6a4304" strokeWidth="0.6" />
      {/* Gravur im Griff */}
      <g transform={rot}>
        <circle cx="26" cy="50" r="13" fill="none" stroke="#7a4c04" strokeOpacity="0.55" strokeWidth="0.6" />
        <circle cx="26.3" cy="50.3" r="13" fill="none" stroke="#fff6c8" strokeOpacity="0.45" strokeWidth="0.5" />
      </g>
    </svg>
  );
}

// ---------- Spickzettel ----------

/** Leicht zittrige Kuli-Linie */
function wobble(x1: number, y: number, x2: number, seed: number): string {
  const n = 4;
  let d = `M${x1} ${y}`;
  for (let i = 1; i <= n; i++) {
    const x = x1 + ((x2 - x1) * i) / n;
    const dy = Math.sin(seed * 7.3 + i * 2.1) * 0.35;
    d += ` Q${f(x - (x2 - x1) / n / 2)} ${f(y + dy)} ${f(x)} ${f(y - dy * 0.5)}`;
  }
  return d;
}

function Staff({ y, notes, ink, seed }: { y: number; notes: Array<[number, number, boolean?]>; ink: string; seed: number }) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={wobble(3, y + i * 2.4, 33, seed + i)} stroke={ink} strokeOpacity="0.6" strokeWidth="0.45" fill="none" />
      ))}
      {notes.map(([x, step, beam], i) => {
        const ny = y + 9.6 - step * 1.2;
        return (
          <g key={i}>
            <ellipse cx={x} cy={ny} rx="1.75" ry="1.2" transform={`rotate(-24 ${x} ${ny})`} fill={ink} />
            <path d={`M${x + 1.5} ${ny} L${x + 1.6} ${ny - 6.8}`} stroke={ink} strokeWidth="0.55" />
            {beam && <path d={`M${x + 1.6} ${ny - 6.8} L${x + 6.4} ${ny - 7.8}`} stroke={ink} strokeWidth="1.2" />}
          </g>
        );
      })}
    </g>
  );
}

export function CheatSheet({ size = 64, className, style }: ArtProps) {
  const id = useSvgId('chs');
  const ink = '#24379a';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Spickzettel">
      <defs>
        <linearGradient id={`${id}-left`} x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.75" stopColor="#f4ead2" />
          <stop offset="1" stopColor="#cdb98c" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#bba774" />
          <stop offset="0.2" stopColor="#e9dcbb" />
          <stop offset="1" stopColor="#f8efd9" />
        </linearGradient>
        <linearGradient id={`${id}-curl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9c79c" />
          <stop offset="1" stopColor="#fff8e6" />
        </linearGradient>
        <Grain id={`${id}-grain`} freq={1.1} amount={0.22} seed={9} />
        <Blur id={`${id}-sh`} std={2.2} />
        <Blur id={`${id}-soft`} std={0.8} />
      </defs>
      <path d="M14 84 L50 91 L88 83 L86 80 L50 87 L16 81 Z" fill="#000" opacity="0.55" filter={`url(#${id}-sh)`} transform="translate(3 2)" />
      <g filter={`url(#${id}-grain)`}>
        {/* linke Hälfte, unten links leicht aufgerollt */}
        <path d="M13 17 L50 23 L50 90 L19 85 C16 84 14 82 13 79 Z" fill={`url(#${id}-left)`} />
        {/* rechte Hälfte mit Eselsohr */}
        <path d="M50 23 L77 17 L87 25.5 L87 82 L50 90 Z" fill={`url(#${id}-right)`} />
      </g>
      {/* Linien und Rand wie im Collegeblock */}
      <g transform="matrix(1 0.1622 0 1 13 17)" opacity="0.55">
        {[14, 20, 26, 32, 38, 44, 50, 56, 62].map((y) => (
          <path key={y} d={`M1 ${y} H37`} stroke="#8fb3e8" strokeWidth="0.35" />
        ))}
        <path d="M6 0 V67" stroke="#ef7b7b" strokeWidth="0.45" />
      </g>
      <g transform="matrix(1 -0.1622 0 1 50 23)" opacity="0.5">
        {[14, 20, 26, 32, 38, 44, 50, 56, 62].map((y) => (
          <path key={y} d={`M0 ${y} H36`} stroke="#8fb3e8" strokeWidth="0.35" />
        ))}
      </g>
      {/* Notizen mit Kuli */}
      <g transform="matrix(1 0.1622 0 1 13 17)">
        <Staff y={6} ink={ink} seed={1} notes={[[13, 3, true], [18, 5], [24, 2, true], [29, 4]]} />
        <Staff y={25} ink={ink} seed={4} notes={[[10, 6], [15, 4, true], [20, 6], [27, 3]]} />
        <path d="M8 47 H30" stroke="#ffe14d" strokeWidth="3.4" strokeOpacity="0.6" strokeLinecap="round" />
        <path d={wobble(9, 47.5, 28, 2)} stroke={ink} strokeWidth="0.55" fill="none" />
        <path d={wobble(9, 54, 24, 6)} stroke={ink} strokeOpacity="0.75" strokeWidth="0.5" fill="none" />
        <path d={wobble(9, 59.5, 20, 9)} stroke={ink} strokeOpacity="0.75" strokeWidth="0.5" fill="none" />
      </g>
      <g transform="matrix(1 -0.1622 0 1 50 23)">
        <Staff y={8} ink={ink} seed={7} notes={[[9, 2], [14, 5, true], [19, 7], [26, 4]]} />
        <path d={wobble(4, 32, 30, 3)} stroke={ink} strokeOpacity="0.75" strokeWidth="0.5" fill="none" />
        <path d={wobble(4, 38, 25, 5)} stroke={ink} strokeOpacity="0.75" strokeWidth="0.5" fill="none" />
        {/* roter Kringel und Pfeil */}
        <ellipse cx="21" cy="50" rx="8" ry="4.2" transform="rotate(-8 21 50)" fill="none" stroke="#d63a3a" strokeWidth="0.75" />
        <path d="M6 56 C9 52 11 51 13.5 51.5" stroke="#d63a3a" strokeWidth="0.75" fill="none" strokeLinecap="round" />
        <path d="M11.5 49.8 L13.6 51.5 L11.3 53" stroke="#d63a3a" strokeWidth="0.75" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Schatten der linken Hälfte auf der rechten (am Knick) */}
      <path d="M50 23 L58 21.6 L58 88.4 L50 90 Z" fill="#6b5631" opacity="0.28" filter={`url(#${id}-soft)`} />
      <path d="M50 23 L50 90" stroke="#9a8453" strokeWidth="0.8" />
      <path d="M49.4 23.4 L49.4 89.6" stroke="#fff" strokeOpacity="0.8" strokeWidth="0.5" />
      {/* Eselsohr (Rückseite sichtbar) */}
      <path d="M77 17 L79 27.5 L87 25.5 Z" fill={`url(#${id}-curl)`} />
      <path d="M79 27.5 L87 25.5" stroke="#000" strokeOpacity="0.2" strokeWidth="0.6" />
      {/* aufgerollte Ecke */}
      <path d="M13 79 C14 82 16 84 19 85 C17 81 18 78 21 77 C18 76 15 77 13 79 Z" fill={`url(#${id}-curl)`} />
      {/* Papierkanten */}
      <path d="M13 17 L50 23 L77 17" stroke="#fff" strokeOpacity="0.9" strokeWidth="0.5" fill="none" />
      <path d="M19 85 L50 90 L87 82" stroke="#8a7547" strokeOpacity="0.7" strokeWidth="0.6" fill="none" />
    </svg>
  );
}

// ---------- Item-Kiste (Holz, Eisen, leuchtender Spalt) ----------

export function ItemCrate({ size = 96, className, style, open = false, glow = true }: ArtProps & { open?: boolean; glow?: boolean }) {
  const id = useSvgId('crt');
  // Schräge Tiefe nach hinten rechts
  const dx = 13;
  const dy = -8;
  const plankTones = ['#b8722f', '#a7652a', '#bf7a38'];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={{ overflow: 'visible', ...style }} role="img" aria-label="Item-Kiste">
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b3a14" />
          <stop offset="1" stopColor="#4a250b" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="1" x2="0.3" y2="0">
          <stop offset="0" stopColor="#d18a46" />
          <stop offset="1" stopColor="#e9a868" />
        </linearGradient>
        <linearGradient id={`${id}-iron`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#9aa3ac" />
          <stop offset="0.45" stopColor="#5d666f" />
          <stop offset="1" stopColor="#2c3238" />
        </linearGradient>
        <radialGradient id={`${id}-burst`} cx="0.5" cy="0.75" r="0.6">
          <stop offset="0" stopColor="#fffbe0" stopOpacity="1" />
          <stop offset="0.35" stopColor="#ffd76a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffb020" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-ray`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff3b0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffd76a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-inside`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="1" stopColor="#ffc640" />
        </linearGradient>
        <WoodGrain id={`${id}-wood`} seed={4} />
        <Glow id={`${id}-glow`} blur={1.6} />
        <Blur id={`${id}-sh`} std={2.6} />
        <Blur id={`${id}-soft`} std={1.2} />
      </defs>

      {/* Lichtstrahlen aus dem Spalt bzw. der offenen Kiste */}
      {glow && (
        <g className={open ? 'crate-rays-open' : 'crate-rays'} style={{ transformOrigin: '47px 46px', transformBox: 'view-box' }}>
          <ellipse cx="47" cy="40" rx={open ? 44 : 30} ry={open ? 34 : 8} fill={`url(#${id}-burst)`} opacity={open ? 1 : 0.55} />
          {(open ? [-58, -34, -14, 4, 22, 42, 62] : [-38, 44]).map((a) => (
            <path key={a} d="M44.5 44 L49.5 44 L54 -12 L40 -12 Z" fill={`url(#${id}-ray)`} transform={`rotate(${a} 47 44)`} opacity={open ? 0.85 : 0.3} />
          ))}
        </g>
      )}

      {/* Schlagschatten */}
      <path d="M13 87 L69 88 L95 81 L84 76 Z" fill="#000" opacity="0.6" filter={`url(#${id}-sh)`} />

      {/* Korpus: rechte Seite */}
      <path d={`M68 50 L${68 + dx} ${50 + dy} L${68 + dx} ${88 + dy} L68 88 Z`} fill={`url(#${id}-side)`} filter={`url(#${id}-wood)`} />
      {[62.7, 75.4].map((y) => (
        <path key={y} d={`M68 ${y} L${68 + dx} ${y + dy}`} stroke="#2e1706" strokeWidth="0.9" />
      ))}
      <path d={`M${68 + dx - 2} ${50 + dy + 1.2} L${68 + dx} ${50 + dy} L${68 + dx} ${88 + dy} L${68 + dx - 2} ${88 + dy + 1.2} Z`} fill="#2c3238" />

      {/* Korpus: Vorderseite aus drei Brettern */}
      {[0, 1, 2].map((i) => (
        <rect key={i} x="12" y={50 + i * 12.67} width="56" height="12.67" fill={plankTones[i]} filter={`url(#${id}-wood)`} />
      ))}
      <rect x="12" y="50" width="56" height="38" fill={`url(#${id}-front)`} />
      {[62.67, 75.33].map((y) => (
        <g key={y}>
          <rect x="12" y={y - 0.6} width="56" height="1.2" fill="#2e1706" />
          <rect x="12" y={y + 0.6} width="56" height="0.6" fill="#f2b072" opacity="0.4" />
        </g>
      ))}
      {/* Eckpfosten */}
      <rect x="12" y="50" width="7" height="38" fill="#8c5020" filter={`url(#${id}-wood)`} />
      <rect x="61" y="50" width="7" height="38" fill="#7a451b" filter={`url(#${id}-wood)`} />
      <path d="M12.5 50 V88" stroke="#f2b072" strokeOpacity="0.55" strokeWidth="0.7" />
      <path d="M19 50 V88 M61 50 V88" stroke="#2e1706" strokeOpacity="0.7" strokeWidth="0.7" />
      {/* Kratzer + Astloch */}
      <ellipse cx="50" cy="81" rx="2.2" ry="1.1" fill="#5a2f10" opacity="0.8" />
      <path d="M24 57 L30 55.8 M46 70 L53 71" stroke="#f2b072" strokeOpacity="0.35" strokeWidth="0.45" strokeLinecap="round" />
      {/* Schatten unter dem Deckel */}
      <rect x="12" y="50" width="56" height="4" fill="#000" opacity="0.45" filter={`url(#${id}-soft)`} />
      {/* Eisenwinkel mit Nieten */}
      <path d="M11 77 H14.5 V85 H22.5 V89 H11 Z" fill={`url(#${id}-iron)`} stroke="#1f2428" strokeWidth="0.5" />
      <path d="M69 77 H65.5 V85 H57.5 V89 H69 Z" fill={`url(#${id}-iron)`} stroke="#1f2428" strokeWidth="0.5" />
      {[
        [13, 80.5],
        [19, 87],
        [67, 80.5],
        [61, 87],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x + 0.3} cy={y + 0.4} r="0.95" fill="#000" opacity="0.5" />
          <circle cx={x} cy={y} r="0.9" fill="#dfe4e8" />
        </g>
      ))}
      {/* Schloss */}
      <rect x="33.5" y="55" width="13" height="14" rx="1.6" fill="#000" opacity="0.4" transform="translate(1 1.2)" />
      <rect x="33.5" y="55" width="13" height="14" rx="1.6" fill={`url(#${id}-iron)`} stroke="#1f2428" strokeWidth="0.6" />
      <path d="M34.5 55.8 H45.5" stroke="#d6dce1" strokeOpacity="0.8" strokeWidth="0.6" />
      <circle cx="40" cy="61" r="1.9" fill="#121518" />
      <path d="M39.1 61.6 H40.9 L41.4 65.5 H38.6 Z" fill="#121518" />

      {/* Innenraum (nur offen) */}
      {open && <path d={`M12 50 L68 50 L${68 + dx} ${50 + dy} L${12 + dx} ${50 + dy} Z`} fill={`url(#${id}-inside)`} filter={`url(#${id}-glow)`} />}

      {/* Deckel */}
      <g className={open ? 'crate-lid-open' : undefined} style={{ transformOrigin: '23px 30px', transformBox: 'view-box' }}>
        <path d={`M10 37 L70 37 L${70 + dx} ${37 + dy} L${10 + dx} ${37 + dy} Z`} fill={`url(#${id}-top)`} filter={`url(#${id}-wood)`} />
        {[25, 40, 55].map((x) => (
          <path key={x} d={`M${x} 37 L${x + dx} ${37 + dy}`} stroke="#5a2f10" strokeOpacity="0.8" strokeWidth="0.8" />
        ))}
        {[17, 58].map((x) => (
          <g key={x}>
            <path d={`M${x} 37 L${x + 5} 37 L${x + 5 + dx} ${37 + dy} L${x + dx} ${37 + dy} Z`} fill="#8d969f" />
            <path d={`M${x} 37 L${x + dx} ${37 + dy}`} stroke="#e3e8ec" strokeWidth="0.5" />
          </g>
        ))}
        <rect x="10" y="37" width="60" height="11" fill="#b06a2c" filter={`url(#${id}-wood)`} />
        <rect x="10" y="37" width="60" height="11" fill={`url(#${id}-front)`} />
        <rect x="10" y="44.5" width="60" height="3.5" fill={`url(#${id}-iron)`} />
        {[17, 58].map((x) => (
          <rect key={x} x={x} y="37" width="5" height="11" fill={`url(#${id}-iron)`} />
        ))}
        <path d="M10 37.3 H70" stroke="#ffd2a3" strokeOpacity="0.9" strokeWidth="0.7" />
        <path d={`M70 37 L${70 + dx} ${37 + dy} L${70 + dx} ${48 + dy} L70 48 Z`} fill="#5c3110" filter={`url(#${id}-wood)`} />
        <path d={`M70 44.5 L${70 + dx} ${44.5 + dy} L${70 + dx} ${48 + dy} L70 48 Z`} fill="#3a4148" />
        <path d="M37 45 H43 V57 C43 58.4 37 58.4 37 57 Z" fill={`url(#${id}-iron)`} stroke="#1f2428" strokeWidth="0.5" />
        {[13, 21, 59, 67].map((x) => (
          <circle key={x} cx={x} cy="46.2" r="0.85" fill="#e3e8ec" />
        ))}
      </g>

      {/* leuchtender Spalt zwischen Deckel und Kiste */}
      {glow && !open && (
        <g className="crate-gap">
          <path d={`M12 49.2 L68 49.2 L${68 + dx} ${49.2 + dy}`} stroke="#ffd76a" strokeWidth="2.2" fill="none" filter={`url(#${id}-glow)`} />
          <path d={`M16 49.2 L66 49.2 L${66 + dx * 0.8} ${49.2 + dy * 0.8}`} stroke="#fffbe0" strokeWidth="0.8" fill="none" />
        </g>
      )}
    </svg>
  );
}

// ---------- Auswahl nach Item ----------

export function ItemIcon({ kind, size = 48, color, className, style, animate }: ArtProps & { kind: ItemKind; color?: string }) {
  switch (kind) {
    case 'freeze':
      return <IceCrystal size={size} className={className} style={style} />;
    case 'ink':
      return <InkSplash size={size} className={className} style={style} />;
    case 'rewind':
      return <RewindCassette size={size} className={className} style={style} animate={animate} />;
    case 'shield':
      return <ShieldArt size={size} className={className} style={style} color={color} />;
    case 'key':
      return <MasterKey size={size} className={className} style={style} />;
    case 'peek':
      return <CheatSheet size={size} className={className} style={style} />;
  }
}
