import type { CSSProperties } from 'react';
import type { ItemKind } from '../../../../shared/types';
import { Emboss, Glow, Grain, GOLD_STOPS, MetalGradient, SILVER_STOPS, Shine, WoodGrain, shade, useSvgId } from './defs';

/**
 * Die Sabotage-Items – alles selbst gezeichnet (keine Emojis, keine Fremdbilder).
 * viewBox 0 0 100 100, gestochen scharf von 24 bis 160 px.
 */

interface ArtProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** kleine Bewegung (Spulen drehen, Glanz …) */
  animate?: boolean;
}

const f = (n: number) => Number(n.toFixed(2));

/** Facettierte Raute von (bx,by) in Richtung angle (0° = oben): linke und rechte Facette */
function kite(bx: number, by: number, angle: number, len: number, hw: number, mid = 0.42): [string, string] {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const px = Math.cos(a);
  const py = Math.sin(a);
  const tx = f(bx + dx * len);
  const ty = f(by + dy * len);
  const mx = bx + dx * len * mid;
  const my = by + dy * len * mid;
  const l = `${f(mx - px * hw)} ${f(my - py * hw)}`;
  const r = `${f(mx + px * hw)} ${f(my + py * hw)}`;
  return [`M${f(bx)} ${f(by)}L${l}L${tx} ${ty}Z`, `M${f(bx)} ${f(by)}L${r}L${tx} ${ty}Z`];
}

// ---------- Eiskristall ----------

const ICE_ARM = (() => {
  const parts: Array<[string, string]> = [kite(50, 50, 0, 44, 6.4, 0.36)];
  for (const s of [-1, 1]) {
    parts.push(kite(50, 31, 56 * s, 13.5, 2.7, 0.45));
    parts.push(kite(50, 19.5, 50 * s, 8.5, 1.9, 0.45));
  }
  return parts;
})();

const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = ((i * 60 - 90) * Math.PI) / 180;
  return [f(50 + Math.cos(a) * 10), f(50 + Math.sin(a) * 10)] as const;
});

export function IceCrystal({ size = 64, className, style }: ArtProps) {
  const id = useSvgId('ice');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Eiskristall">
      <defs>
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#9be7ff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#4cc4f0" stopOpacity="0.18" />
          <stop offset="1" stopColor="#4cc4f0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#c9f3ff" />
          <stop offset="1" stopColor="#7fd6f7" />
        </linearGradient>
        <linearGradient id={`${id}-dark`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#a6e8ff" />
          <stop offset="0.5" stopColor="#45afe0" />
          <stop offset="1" stopColor="#1a6aa3" />
        </linearGradient>
        <Grain id={`${id}-grain`} freq={1.8} amount={0.28} seed={11} />
        <Shine id={`${id}-shine`} opacity={0.9} dur={3.2} />
      </defs>
      <circle cx="50" cy="50" r="49" fill={`url(#${id}-halo)`} />
      <g filter={`url(#${id}-grain)`} stroke="#effcff" strokeWidth="0.7" strokeLinejoin="round">
        {[0, 60, 120, 180, 240, 300].map((r) => (
          <g key={r} transform={`rotate(${r} 50 50)`}>
            {ICE_ARM.map(([l, rr], i) => (
              <g key={i}>
                <path d={l} fill={`url(#${id}-light)`} />
                <path d={rr} fill={`url(#${id}-dark)`} />
              </g>
            ))}
          </g>
        ))}
        {HEX.map(([x, y], i) => {
          const [nx, ny] = HEX[(i + 1) % 6];
          return <path key={i} d={`M50 50L${x} ${y}L${nx} ${ny}Z`} fill={i % 2 ? `url(#${id}-dark)` : `url(#${id}-light)`} />;
        })}
      </g>
      <circle cx="50" cy="50" r="3.2" fill="#ffffff" />
      {/* Funkeln */}
      <path d="M31 21 C31.6 25 32.4 25.8 36.5 26.5 C32.4 27.2 31.6 28 31 32 C30.4 28 29.6 27.2 25.5 26.5 C29.6 25.8 30.4 25 31 21Z" fill="#fff" />
      <path d="M72 66 C72.4 68.5 72.9 69 75.5 69.5 C72.9 70 72.4 70.5 72 73 C71.6 70.5 71.1 70 68.5 69.5 C71.1 69 71.6 68.5 72 66Z" fill="#fff" opacity="0.85" />
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

// ---------- Tintenklecks ----------

const INK_BLOB =
  'M50 13 C57 13 60 21 66 22 C74 23 79 16 86 22 C93 29 84 37 86 44 C88 51 96 54 93 62 C90 70 80 66 75 72 C70 78 75 88 64 90 C55 91 54 81 47 80 C40 79 36 89 27 85 C18 81 25 71 20 65 C15 59 5 58 7 49 C9 40 20 43 23 36 C26 29 18 22 25 16 C32 11 40 18 45 15 C47 14 48 13 50 13 Z';
const INK_POOL =
  'M50 30 C56 30 58 35 63 36 C69 37 72 43 70 49 C68 56 72 62 66 67 C60 72 55 66 49 68 C43 70 37 70 34 64 C31 58 33 54 31 48 C29 42 34 37 40 36 C44 35 45 30 50 30 Z';

export function InkBlot({ size = 64, className, style, lite = false }: ArtProps & { lite?: boolean }) {
  const id = useSvgId('ink');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Tintenklecks">
      <defs>
        <radialGradient id={`${id}-ink`} cx="0.4" cy="0.34" r="0.75">
          <stop offset="0" stopColor="#7a63f0" />
          <stop offset="0.38" stopColor="#3a2796" />
          <stop offset="0.8" stopColor="#170f45" />
          <stop offset="1" stopColor="#0b0724" />
        </radialGradient>
        <radialGradient id={`${id}-pool`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#0a0620" stopOpacity="0.7" />
          <stop offset="1" stopColor="#0a0620" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <Grain id={`${id}-grain`} freq={1.4} amount={0.35} seed={5} />
      </defs>
      <g filter={lite ? undefined : `url(#${id}-grain)`}>
        <path d={INK_BLOB} fill={`url(#${id}-ink)`} stroke="#a898ff" strokeOpacity="0.55" strokeWidth="1.3" />
        <path d={INK_POOL} fill={`url(#${id}-pool)`} />
        {/* Tropfen und Spritzer */}
        <path d="M58 89 C58 94 60 97 62 97 C64 97 65 94 64.5 90 Z" fill={`url(#${id}-ink)`} stroke="#a898ff" strokeOpacity="0.45" strokeWidth="1" />
        {[
          [90, 13, 3.4],
          [11, 79, 2.8],
          [82, 89, 2.2],
          [8, 29, 2],
          [95, 79, 1.6],
          [37, 6, 1.7],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={`url(#${id}-ink)`} stroke="#a898ff" strokeOpacity="0.5" strokeWidth="0.8" />
        ))}
      </g>
      {/* nasser Glanz */}
      <ellipse cx="38" cy="31" rx="13" ry="5.5" transform="rotate(-28 38 31)" fill="#fff" opacity={lite ? 0.3 : 0.55} filter={lite ? undefined : `url(#${id}-soft)`} />
      <ellipse cx="33" cy="34" rx="4" ry="2" transform="rotate(-28 33 34)" fill="#fff" opacity="0.9" />
      <circle cx="89" cy="12" r="1" fill="#fff" opacity="0.85" />
      {!lite && <circle cx="68" cy="73" r="2.2" fill="#fff" opacity="0.25" filter={`url(#${id}-soft)`} />}
    </svg>
  );
}

// ---------- Rückspul-Kassette ----------

function Reel({ cx, cy, spin, id }: { cx: number; cy: number; spin: boolean; id: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="6.6" fill="#5b3a26" />
      <circle cx={cx} cy={cy} r="4.7" fill={`url(#${id}-hub)`} />
      <g>
        {[0, 60, 120, 180, 240, 300].map((r) => (
          <rect key={r} x={cx - 0.7} y={cy - 4.6} width="1.4" height="2.2" rx="0.4" fill="#2a1a12" transform={`rotate(${r} ${cx} ${cy})`} />
        ))}
        {spin && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`-360 ${cx} ${cy}`} dur="0.9s" repeatCount="indefinite" />}
      </g>
      <circle cx={cx} cy={cy} r="1.5" fill="#2a1a12" />
    </g>
  );
}

export function RewindCassette({ size = 64, className, style, animate = true }: ArtProps) {
  const id = useSvgId('cas');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Rückspul-Kassette">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#ffa37a" />
          <stop offset="0.35" stopColor="#ff6c3d" />
          <stop offset="1" stopColor="#b9391b" />
        </linearGradient>
        <linearGradient id={`${id}-label`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8e6" />
          <stop offset="1" stopColor="#f0ddb2" />
        </linearGradient>
        <linearGradient id={`${id}-window`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b2a22" />
          <stop offset="1" stopColor="#140c08" />
        </linearGradient>
        <radialGradient id={`${id}-hub`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9ced4" />
        </radialGradient>
        <MetalGradient id={`${id}-screw`} stops={SILVER_STOPS} />
        <Grain id={`${id}-grain`} freq={1.6} amount={0.4} seed={8} />
        <Emboss id={`${id}-emboss`} strength={0.3} blur={1} />
        <Shine id={`${id}-shine`} opacity={0.6} dur={4} />
      </defs>
      <ellipse cx="50" cy="88" rx="40" ry="4" fill="#000" opacity="0.35" />
      <g filter={`url(#${id}-emboss)`}>
        <rect x="6" y="19" width="88" height="63" rx="7" fill={`url(#${id}-body)`} stroke="#7d2711" strokeWidth="1.2" filter={`url(#${id}-grain)`} />
      </g>
      <rect x="9" y="21.5" width="82" height="2" rx="1" fill="#fff" opacity="0.35" />
      {/* Etikett */}
      <rect x="13" y="26" width="74" height="31" rx="3" fill={`url(#${id}-label)`} filter={`url(#${id}-grain)`} />
      <rect x="13" y="26" width="74" height="6.5" rx="3" fill="#2b2b2b" />
      <rect x="13" y="30" width="74" height="2.5" fill="#2b2b2b" />
      {/* Rückspul-Zeichen ◀◀ */}
      <path d="M33 27.4 L27.5 29.3 L33 31.2 Z M27.5 27.4 L22 29.3 L27.5 31.2 Z" fill="#ff6c3d" />
      <rect x="40" y="28.6" width="24" height="1.4" rx="0.7" fill="#fff" opacity="0.6" />
      {/* Fenster mit Spulen */}
      <rect x="27" y="36.5" width="46" height="16" rx="8" fill={`url(#${id}-window)`} stroke="#c9b48a" strokeWidth="0.8" />
      <path d="M39 49 Q50 52 61 49" stroke="#6b4228" strokeWidth="2.2" fill="none" />
      <Reel cx={38.5} cy={44.5} spin={animate} id={id} />
      <Reel cx={61.5} cy={44.5} spin={animate} id={id} />
      <rect x="29" y="38" width="42" height="3" rx="1.5" fill="#fff" opacity="0.12" />
      {/* Unterteil */}
      <path d="M23 82 L27.5 66 L72.5 66 L77 82 Z" fill="#a8341a" stroke="#7d2711" strokeWidth="1" />
      <circle cx="37" cy="75" r="2.2" fill="#3a140a" />
      <circle cx="63" cy="75" r="2.2" fill="#3a140a" />
      <rect x="45" y="72.5" width="3.5" height="3.5" rx="0.6" fill="#3a140a" />
      <rect x="51.5" y="72.5" width="3.5" height="3.5" rx="0.6" fill="#3a140a" />
      {/* Schrauben */}
      {[
        [11, 24],
        [89, 24],
        [11, 77],
        [89, 77],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="2.3" fill={`url(#${id}-screw)`} stroke="#5a3a2a" strokeWidth="0.5" />
          <path d={`M${x - 1.3} ${y} H${x + 1.3}`} stroke="#5a3a2a" strokeWidth="0.6" />
        </g>
      ))}
      <rect x="6" y="19" width="88" height="63" rx="7" fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

// ---------- Schild ----------

const SHIELD = 'M50 6 C63 12 75 13 88 11 C89 52 76 79 50 95 C24 79 11 52 12 11 C25 13 37 12 50 6 Z';
const SHIELD_INNER = 'M50 14 C61 19 71 20 81 19 C81 52 71 73 50 86 C29 73 19 52 19 19 C29 20 39 19 50 14 Z';

export function ShieldArt({ size = 64, className, style, color = '#509bf5' }: ArtProps & { color?: string }) {
  const id = useSvgId('shd');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Schild">
      <defs>
        <MetalGradient id={`${id}-rim`} stops={SILVER_STOPS} />
        <linearGradient id={`${id}-field`} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor={shade(color, 0.45)} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.55)} />
        </linearGradient>
        <radialGradient id={`${id}-boss`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#c3ccd5" />
          <stop offset="1" stopColor="#59636d" />
        </radialGradient>
        <Grain id={`${id}-grain`} freq={1.6} amount={0.42} seed={3} />
        <Emboss id={`${id}-emboss`} strength={0.45} />
        <Shine id={`${id}-shine`} opacity={0.8} />
      </defs>
      <path d={SHIELD} fill="#1c2329" transform="translate(0 2)" opacity="0.6" />
      <g filter={`url(#${id}-emboss)`}>
        <path d={SHIELD} fill={`url(#${id}-rim)`} stroke="#3c444c" strokeWidth="1.2" filter={`url(#${id}-grain)`} />
      </g>
      <path d={SHIELD_INNER} fill={`url(#${id}-field)`} filter={`url(#${id}-grain)`} stroke={shade(color, -0.6)} strokeWidth="1" />
      {/* rechte Hälfte etwas dunkler → Mittelgrat */}
      <path d="M50 14 C61 19 71 20 81 19 C81 52 71 73 50 86 Z" fill="#000" opacity="0.18" />
      <path d="M50 14 L50 86" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" />
      {/* Nieten */}
      {[
        [21, 17],
        [79, 17],
        [16, 44],
        [84, 44],
        [30, 74],
        [70, 74],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" fill={`url(#${id}-boss)`} stroke="#3c444c" strokeWidth="0.5" />
      ))}
      <g filter={`url(#${id}-emboss)`}>
        <circle cx="50" cy="44" r="11" fill={`url(#${id}-boss)`} stroke="#3c444c" strokeWidth="1" />
      </g>
      <circle cx="46.5" cy="40.5" r="3.4" fill="#fff" opacity="0.85" />
      <path d={SHIELD} fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

// ---------- Generalschlüssel ----------

export function MasterKey({ size = 64, className, style }: ArtProps) {
  const id = useSvgId('key');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Generalschlüssel">
      <defs>
        <MetalGradient id={`${id}-gold`} stops={GOLD_STOPS} />
        <mask id={`${id}-cut`} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100" height="100" fill="#fff" />
          {/* Kleeblatt-Ausschnitt im Griff */}
          <circle cx="19" cy="50" r="4.6" fill="#000" />
          <circle cx="33" cy="50" r="4.6" fill="#000" />
          <circle cx="26" cy="43" r="4.6" fill="#000" />
          <circle cx="26" cy="57" r="4.6" fill="#000" />
          <circle cx="26" cy="50" r="4.6" fill="#000" />
        </mask>
        <Grain id={`${id}-grain`} freq={1.6} amount={0.5} seed={7} />
        <Emboss id={`${id}-emboss`} strength={0.4} />
        <Shine id={`${id}-shine`} opacity={0.9} dur={3} />
      </defs>
      <g transform="rotate(-38 50 50) translate(2 0)" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' }}>
        <g filter={`url(#${id}-emboss)`}>
          <g fill={`url(#${id}-gold)`} stroke="#6e4706" strokeWidth="1.3" strokeLinejoin="round" filter={`url(#${id}-grain)`}>
            {/* Griff */}
            <circle cx="26" cy="50" r="17.5" mask={`url(#${id}-cut)`} />
            {/* Schaft + Bart */}
            <path d="M42 46 H88 C90.5 46 92 47.8 92 50 C92 52.2 90.5 54 88 54 H86 V67 H81 V61.5 H77 V69 H72 V61.5 H68 V54 H42 Z" />
            {/* Kragen */}
            <rect x="41" y="42.5" width="5.5" height="15" rx="2.2" />
            <rect x="48.5" y="44" width="3.6" height="12" rx="1.6" />
          </g>
        </g>
        <circle cx="26" cy="50" r="13.2" fill="none" stroke="#fff3c4" strokeOpacity="0.55" strokeWidth="1.1" mask={`url(#${id}-cut)`} />
        <path d="M54 47.6 H87" stroke="#fff8d8" strokeOpacity="0.7" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="26" cy="50" r="17.5" fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} mask={`url(#${id}-cut)`} />
        <rect x="42" y="46" width="50" height="23" fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
      </g>
    </svg>
  );
}

// ---------- Spickzettel ----------

/** Notenzeile mit ein paar Noten, im lokalen Koordinatensystem eines Zettel-Blatts */
function Staff({ y, notes, ink }: { y: number; notes: Array<[number, number, boolean?]>; ink: string }) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="3" x2="33" y1={y + i * 2.6} y2={y + i * 2.6} stroke={ink} strokeOpacity="0.55" strokeWidth="0.5" />
      ))}
      {notes.map(([x, step, beam], i) => {
        const ny = y + 10.4 - step * 1.3;
        return (
          <g key={i}>
            <ellipse cx={x} cy={ny} rx="1.75" ry="1.25" transform={`rotate(-22 ${x} ${ny})`} fill={ink} />
            <line x1={x + 1.5} x2={x + 1.5} y1={ny} y2={ny - 7} stroke={ink} strokeWidth="0.55" />
            {beam && <path d={`M${x + 1.5} ${ny - 7} L${x + 6.5} ${ny - 8.3}`} stroke={ink} strokeWidth="1.3" />}
          </g>
        );
      })}
    </g>
  );
}

export function CheatSheet({ size = 64, className, style }: ArtProps) {
  const id = useSvgId('chs');
  const ink = '#2a2f5a';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label="Spickzettel">
      <defs>
        <linearGradient id={`${id}-left`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.85" stopColor="#f7ebcf" />
          <stop offset="1" stopColor="#e2cf9f" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9c591" />
          <stop offset="0.18" stopColor="#f1e3bf" />
          <stop offset="1" stopColor="#fbf2dc" />
        </linearGradient>
        <Grain id={`${id}-grain`} freq={1.2} amount={0.5} seed={9} />
      </defs>
      <ellipse cx="50" cy="92" rx="38" ry="4" fill="#000" opacity="0.35" />
      <g filter={`url(#${id}-grain)`}>
        {/* linke Hälfte */}
        <path d="M13 17 L50 23 L50 90 L13 84 Z" fill={`url(#${id}-left)`} stroke="#b9a271" strokeWidth="0.6" />
        {/* rechte Hälfte mit Eselsohr */}
        <path d="M50 23 L77 17 L87 25 L87 82 L50 90 Z" fill={`url(#${id}-right)`} stroke="#b9a271" strokeWidth="0.6" />
        <path d="M77 17 L78.5 26.5 L87 25 Z" fill="#e6d3a5" stroke="#b9a271" strokeWidth="0.6" />
      </g>
      {/* Inhalt links */}
      <g transform="matrix(1 0.1622 0 1 13 17)">
        <path d="M5 4 C3.5 7 6.5 8.5 5.5 12 C4.8 14.5 3 14 3.6 11.8" stroke={ink} strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <Staff y={7} ink={ink} notes={[[12, 3, true], [17, 5], [23, 2, true], [28, 4]]} />
        <Staff y={28} ink={ink} notes={[[8, 6], [14, 4, true], [19, 6], [26, 3]]} />
        <rect x="3" y="48" width="22" height="3.4" rx="1.4" fill="#ff4fa0" opacity="0.45" />
        <path d="M4 56 H27 M4 60.5 H20" stroke={ink} strokeOpacity="0.45" strokeWidth="0.7" strokeLinecap="round" />
      </g>
      {/* Inhalt rechts */}
      <g transform="matrix(1 -0.1622 0 1 50 23)">
        <Staff y={10} ink={ink} notes={[[8, 2], [13, 5, true], [18, 7], [25, 4]]} />
        <path d="M4 34 H28 M4 39 H24 M4 44 H29" stroke={ink} strokeOpacity="0.45" strokeWidth="0.7" strokeLinecap="round" />
        {/* Pfeil + Kringel: „hier lang!“ */}
        <path d="M6 54 C12 50 18 58 25 53" stroke="#1ed760" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M22.5 50.5 L25.5 53 L22 55.2" stroke="#1ed760" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Knick in der Mitte */}
      <path d="M50 23 L50 90" stroke="#a8925f" strokeWidth="0.9" />
      <path d="M50.6 23.3 L50.6 89.7" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.6" />
    </svg>
  );
}

// ---------- Item-Kiste ----------

export function ItemCrate({ size = 96, className, style, open = false, glow = true }: ArtProps & { open?: boolean; glow?: boolean }) {
  const id = useSvgId('crt');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={{ overflow: 'visible', ...style }} role="img" aria-label="Item-Kiste">
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d58c48" />
          <stop offset="0.25" stopColor="#b56d31" />
          <stop offset="1" stopColor="#7c4318" />
        </linearGradient>
        <linearGradient id={`${id}-woodDark`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a4c1d" />
          <stop offset="0.5" stopColor="#a2602a" />
          <stop offset="1" stopColor="#6a3711" />
        </linearGradient>
        <MetalGradient id={`${id}-metal`} stops={['#f2f5f8', '#c4ccd4', '#8b959f', '#4b535b', '#aab3bc', '#3c434a', '#d3dae0']} />
        <radialGradient id={`${id}-burst`} cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="#fff6c8" stopOpacity="1" />
          <stop offset="0.35" stopColor="#ffd76a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffb020" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-ray`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff3b0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd76a" stopOpacity="0" />
        </linearGradient>
        <WoodGrain id={`${id}-grain`} seed={4} />
        <Grain id={`${id}-mgrain`} freq={1.8} amount={0.45} seed={2} />
        <Glow id={`${id}-glow`} blur={1.6} />
        <Emboss id={`${id}-emboss`} strength={0.35} blur={0.9} scale={3} />
      </defs>

      {/* Lichtstrahlen aus dem Spalt / der offenen Kiste */}
      {glow && (
        <g className={open ? 'crate-rays-open' : 'crate-rays'} style={{ transformOrigin: '50px 38px', transformBox: 'view-box' }}>
          <ellipse cx="50" cy="36" rx={open ? 46 : 34} ry={open ? 34 : 9} fill={`url(#${id}-burst)`} />
          {(open ? [-62, -38, -16, 0, 16, 38, 62] : [-40, 40]).map((a) => (
            <path key={a} d="M47.5 38 L52.5 38 L56 -14 L44 -14 Z" fill={`url(#${id}-ray)`} transform={`rotate(${a} 50 38)`} opacity={open ? 0.9 : 0.35} />
          ))}
        </g>
      )}

      <ellipse cx="50" cy="91" rx="41" ry="5" fill="#000" opacity="0.45" />

      {/* Korpus */}
      <g>
        <rect x="13" y="39" width="74" height="50" rx="2.5" fill="#4a250c" />
        {[39, 55.7, 72.4].map((y) => (
          <rect key={y} x="13" y={y} width="74" height="16.3" fill={`url(#${id}-wood)`} filter={`url(#${id}-grain)`} />
        ))}
        {[55.6, 72.3].map((y) => (
          <g key={y}>
            <rect x="13" y={y - 0.6} width="74" height="1.3" fill="#3a1d08" />
            <rect x="13" y={y + 0.7} width="74" height="0.7" fill="#f0a868" opacity="0.35" />
          </g>
        ))}
        <rect x="13" y="39" width="9" height="50" fill={`url(#${id}-woodDark)`} filter={`url(#${id}-grain)`} />
        <rect x="78" y="39" width="9" height="50" fill={`url(#${id}-woodDark)`} filter={`url(#${id}-grain)`} />
        <rect x="13" y="39" width="74" height="50" rx="2.5" fill="none" stroke="#3a1d08" strokeWidth="1.2" />
        {/* Metall-Ecken */}
        <g filter={`url(#${id}-emboss)`}>
          <g fill={`url(#${id}-metal)`} stroke="#2c3137" strokeWidth="0.7" filter={`url(#${id}-mgrain)`}>
            <path d="M12 76 H15 V86 H25 V89.5 H12 Z" />
            <path d="M88 76 H85 V86 H75 V89.5 H88 Z" />
            <path d="M12 52 H15 V42.5 H25 V39 H12 Z" />
            <path d="M88 52 H85 V42.5 H75 V39 H88 Z" />
            {/* Schloss */}
            <rect x="41.5" y="46" width="17" height="19" rx="2.4" />
          </g>
        </g>
        {[
          [18, 81],
          [82, 81],
          [18, 46],
          [82, 46],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#e9edf1" stroke="#2c3137" strokeWidth="0.4" />
        ))}
        <circle cx="50" cy="55" r="2.6" fill="#15181b" />
        <path d="M48.8 56 L51.2 56 L52 61.5 L48 61.5 Z" fill="#15181b" />
        <rect x="43" y="47.4" width="14" height="1.3" rx="0.6" fill="#fff" opacity="0.45" />
      </g>

      {/* Deckel */}
      <g className={open ? 'crate-lid-open' : undefined} style={{ transformOrigin: '10px 37px', transformBox: 'view-box' }}>
        <rect x="9.5" y="22" width="81" height="15.5" rx="3" fill="#4a250c" />
        <rect x="9.5" y="22" width="81" height="11" rx="3" fill={`url(#${id}-wood)`} filter={`url(#${id}-grain)`} />
        <rect x="10.5" y="23" width="79" height="1.5" rx="0.75" fill="#ffd2a3" opacity="0.45" />
        <g filter={`url(#${id}-emboss)`}>
          <g fill={`url(#${id}-metal)`} stroke="#2c3137" strokeWidth="0.7" filter={`url(#${id}-mgrain)`}>
            <rect x="9" y="32" width="82" height="5.5" rx="1.6" />
            {/* Überfalle zum Schloss */}
            <path d="M45.5 33 H54.5 V47 C54.5 49 45.5 49 45.5 47 Z" />
          </g>
        </g>
        {[15, 30, 70, 85].map((x) => (
          <circle key={x} cx={x} cy="34.7" r="1.1" fill="#e9edf1" stroke="#2c3137" strokeWidth="0.35" />
        ))}
        <rect x="9.5" y="22" width="81" height="15.5" rx="3" fill="none" stroke="#3a1d08" strokeWidth="1.1" />
      </g>

      {/* leuchtender Spalt zwischen Deckel und Kiste */}
      {glow && !open && (
        <g className="crate-gap">
          <rect x="16" y="37.3" width="68" height="2.4" rx="1.2" fill="#ffd76a" filter={`url(#${id}-glow)`} />
          <rect x="22" y="37.9" width="56" height="1.1" rx="0.55" fill="#fffbe0" />
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
      return <InkBlot size={size} className={className} style={style} />;
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
