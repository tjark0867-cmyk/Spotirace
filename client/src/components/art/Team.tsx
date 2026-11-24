import type { CSSProperties } from 'react';
import { TEAM_COLORS, TEAM_NAMES, type CheerKind, type TeamId } from '../../../../shared/types';
import { Blur, Glow, Grain, shade, useSvgId } from './defs';

/**
 * Team-Staffel: Wappen, Staffelstab, Wechselzonen-Banner, Anfeuer-Grafiken.
 * Selbst gezeichnet, mit Materialstärke und einer Lichtquelle oben links.
 */

interface ArtProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const f = (n: number) => Number(n.toFixed(2));

function GoldGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stopColor="#fff3b8" />
      <stop offset="0.25" stopColor="#ffd24a" />
      <stop offset="0.55" stopColor="#d89412" />
      <stop offset="0.8" stopColor="#9c6206" />
      <stop offset="1" stopColor="#e6b03a" />
    </linearGradient>
  );
}

// ---------- Team-Wappen ----------

const CREST = 'M50 5 L87 13 L87 45 C87 70 71 86 50 96 C29 86 13 70 13 45 L13 13 Z';
const FIELD = 'M50 12.5 L80 19 L80 45 C80 66 67 80 50 88.5 C33 80 20 66 20 45 L20 19 Z';
const BARS = [10, 22, 34, 44, 34, 22, 10];

export function TeamCrest({ team, size = 64, className, style }: ArtProps & { team: TeamId }) {
  const id = useSvgId('crs');
  const color = TEAM_COLORS[team];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label={`Wappen ${TEAM_NAMES[team]}`}>
      <defs>
        <GoldGradient id={`${id}-gold`} />
        <linearGradient id={`${id}-hi`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.45" stopColor="#fffbe6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-field`} cx="0.32" cy="0.22" r="0.95">
          <stop offset="0" stopColor={shade(color, 0.35)} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.62)} />
        </radialGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor={shade(color, 0.7)} />
          <stop offset="1" stopColor={shade(color, 0.05)} />
        </linearGradient>
        <clipPath id={`${id}-fclip`}>
          <path d={FIELD} />
        </clipPath>
        <clipPath id={`${id}-cclip`}>
          <path d={CREST} />
        </clipPath>
        <Grain id={`${id}-grain`} freq={1.6} amount={0.4} seed={6} />
        <Blur id={`${id}-sh`} std={2.2} />
        <Blur id={`${id}-in`} std={1.3} />
        <Blur id={`${id}-bs`} std={0.7} />
      </defs>
      <ellipse cx="54" cy="96" rx="27" ry="3.6" fill="#000" opacity="0.55" filter={`url(#${id}-sh)`} />
      {/* Materialstärke */}
      {[5, 4, 3, 2, 1].map((i) => (
        <path key={i} d={CREST} fill={i > 2 ? '#3d2600' : '#6e4706'} transform={`translate(${0.45 * i} ${0.9 * i})`} />
      ))}
      {/* Goldrahmen mit Fase */}
      <path d={CREST} fill={`url(#${id}-gold)`} filter={`url(#${id}-grain)`} />
      <g clipPath={`url(#${id}-cclip)`}>
        <path d={CREST} fill="none" stroke={`url(#${id}-hi)`} strokeWidth="2.6" transform="translate(-0.6 -0.6)" />
        <path d={CREST} fill="none" stroke="#5c3a03" strokeOpacity="0.6" strokeWidth="1.6" transform="translate(0.7 0.7)" />
      </g>
      {/* eingelassene Kante */}
      <path d={FIELD} fill="none" stroke="#4a2f02" strokeWidth="2.4" />
      <path d={FIELD} fill="none" stroke="#fff3c4" strokeOpacity="0.55" strokeWidth="0.7" transform="translate(0.9 0.9)" />
      {/* Feld in Teamfarbe, gewölbt */}
      <path d={FIELD} fill={`url(#${id}-field)`} filter={`url(#${id}-grain)`} />
      <g clipPath={`url(#${id}-fclip)`}>
        {/* Schildhaupt */}
        <rect x="0" y="0" width="100" height="29" fill={shade(color, -0.5)} opacity="0.85" />
        <rect x="0" y="29" width="100" height="2.2" fill="#000" opacity="0.4" filter={`url(#${id}-bs)`} />
        <rect x="0" y="27.6" width="100" height="1.8" fill={`url(#${id}-gold)`} />
        {/* Rahmen wirft Schatten ins Feld */}
        <path d={`M-20 -20 H120 V120 H-20 Z ${FIELD}`} fillRule="evenodd" fill="#000" opacity="0.6" transform="translate(1.6 2)" filter={`url(#${id}-in)`} />
      </g>
      {/* goldene Note im Schildhaupt */}
      <g transform="translate(0.7 1)" opacity="0.5" filter={`url(#${id}-bs)`}>
        <ellipse cx="47" cy="23.5" rx="2.8" ry="2" transform="rotate(-22 47 23.5)" fill="#000" />
        <path d="M49.4 23 V14.5 C52.5 15.5 55 17.5 54 21.5" stroke="#000" strokeWidth="1.3" fill="none" />
      </g>
      <ellipse cx="47" cy="23.5" rx="2.8" ry="2" transform="rotate(-22 47 23.5)" fill={`url(#${id}-gold)`} stroke="#6e4706" strokeWidth="0.4" />
      <path d="M49.4 23 V14.5 C52.5 15.5 55 17.5 54 21.5" stroke="#ffd24a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Soundwelle: erhabene Stäbe mit Schatten */}
      {BARS.map((h, i) => {
        const x = 23.3 + i * 8;
        const y = 58 - h / 2;
        return (
          <g key={i}>
            <rect x={x + 1.1} y={y + 1.6} width="5.4" height={h} rx="2.7" fill="#000" opacity="0.5" filter={`url(#${id}-bs)`} />
            <rect x={x} y={y} width="5.4" height={h} rx="2.7" fill={`url(#${id}-bar)`} />
            <ellipse cx={x + 1.9} cy={y + 2.4} rx="0.9" ry="1.3" fill="#fff" opacity="0.9" />
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Staffelstab (Alu-Rohr mit Streifen, hohles Ende) ----------

export function Baton({ size = 64, className, style, motion = false }: ArtProps & { motion?: boolean }) {
  const id = useSvgId('btn');
  const r = 8.5;
  const top = 50 - r;
  const bot = 50 + r;
  const ex = 3.2;
  const band = (xa: number, xb: number) => `M${xa} ${top}A${ex} ${r} 0 0 1 ${xa} ${bot}L${xb} ${bot}A${ex} ${r} 0 0 0 ${xb} ${top}Z`;
  const body = `M14 ${top}L86 ${top}A${ex} ${r} 0 0 1 86 ${bot}L14 ${bot}A${ex} ${r} 0 0 1 14 ${top}Z`;
  const stripes = [22, 33, 44, 55, 66];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={{ overflow: 'visible', ...style }} role="img" aria-label="Staffelstab">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8d0d7" />
          <stop offset="0.5" stopColor="#9aa5af" />
          <stop offset="1" stopColor="#6d7883" />
        </linearGradient>
        <linearGradient id={`${id}-round`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="0.32" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#000" stopOpacity="0.1" />
          <stop offset="0.88" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${id}-end`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef2f5" />
          <stop offset="1" stopColor="#7a858f" />
        </linearGradient>
        <radialGradient id={`${id}-hole`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#0b0d10" />
          <stop offset="0.8" stopColor="#2b3238" />
          <stop offset="1" stopColor="#59636c" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d={body} />
        </clipPath>
        <Grain id={`${id}-grain`} freq="0.3 2.2" amount={0.4} seed={12} />
        <Blur id={`${id}-sh`} std={2.2} />
      </defs>
      {/* Schatten auf dem Boden */}
      <ellipse cx="52" cy="74" rx="38" ry="4.5" transform="rotate(-25 52 74)" fill="#000" opacity="0.5" filter={`url(#${id}-sh)`} />
      <g transform="rotate(-25 50 50)">
        {motion && (
          <g stroke="#fff" strokeLinecap="round" opacity="0.5">
            <path d="M-6 44 H4" strokeWidth="1.6" />
            <path d="M-16 50 H2" strokeWidth="2" />
            <path d="M-4 56 H5" strokeWidth="1.4" />
          </g>
        )}
        <g clipPath={`url(#${id}-clip)`}>
          <path d={body} fill={`url(#${id}-metal)`} filter={`url(#${id}-grain)`} />
          {stripes.map((x, i) => (
            <path key={x} d={band(x, x + 6.5)} fill={i % 2 ? TEAM_COLORS.pink : TEAM_COLORS.green} />
          ))}
          <rect x="0" y={top} width="100" height={2 * r} fill={`url(#${id}-round)`} />
          <path d={`M15 ${top + 2.6} H84`} stroke="#fff" strokeOpacity="0.9" strokeWidth="1.1" strokeLinecap="round" />
        </g>
        <path d={body} fill="none" stroke="#2c3238" strokeWidth="0.7" />
        {/* offenes, hohles Ende vorne */}
        <ellipse cx="86" cy="50" rx={ex} ry={r} fill={`url(#${id}-end)`} stroke="#2c3238" strokeWidth="0.6" />
        <ellipse cx="86.3" cy="50" rx={ex * 0.62} ry={r * 0.7} fill={`url(#${id}-hole)`} />
      </g>
    </svg>
  );
}

// ---------- Wechselzonen-Banner (gewölbtes Band mit eingeschlagenen Enden) ----------

export function ZoneBanner({ team, label = 'WECHSELZONE', width = 300, className }: { team: TeamId; label?: string; width?: number; className?: string }) {
  const id = useSvgId('zb');
  const color = TEAM_COLORS[team];
  const bandPath = 'M28 26 Q160 6 292 26 L292 62 Q160 42 28 62 Z';
  return (
    <svg width={width} height={width * (84 / 320)} viewBox="0 0 320 84" className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 0.3)} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.45)} />
        </linearGradient>
        <linearGradient id={`${id}-curve`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.4" />
          <stop offset="0.2" stopColor="#000" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`${id}-tail`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, -0.35)} />
          <stop offset="1" stopColor={shade(color, -0.65)} />
        </linearGradient>
        <GoldGradient id={`${id}-gold`} />
        <pattern id={`${id}-hatch`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="6" height="12" fill="#fff" opacity="0.85" />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <path d={bandPath} />
        </clipPath>
        <path id={`${id}-text`} d="M40 52 Q160 33 280 52" />
        <Grain id={`${id}-grain`} freq={1.2} amount={0.35} seed={3} />
        <Blur id={`${id}-sh`} std={2.5} />
        <Blur id={`${id}-soft`} std={1} />
      </defs>
      {/* Schatten unter dem ganzen Band */}
      <path d="M10 46 Q160 30 310 46 L310 82 Q160 66 10 82 Z" fill="#000" opacity="0.45" filter={`url(#${id}-sh)`} />
      {/* eingeschlagene Enden hinten */}
      <path d="M4 38 L46 38 L46 76 L4 76 L17 57 Z" fill={`url(#${id}-tail)`} filter={`url(#${id}-grain)`} />
      <path d="M316 38 L274 38 L274 76 L316 76 L303 57 Z" fill={`url(#${id}-tail)`} filter={`url(#${id}-grain)`} />
      <path d="M28 62 L46 76 L46 60 Z" fill={shade(color, -0.8)} />
      <path d="M292 62 L274 76 L274 60 Z" fill={shade(color, -0.8)} />
      {/* das Band wirft Schatten auf die Enden */}
      <path d="M30 60 Q36 59 46 58 L46 66 Q38 66 30 66 Z" fill="#000" opacity="0.35" filter={`url(#${id}-soft)`} />
      <path d="M290 60 Q284 59 274 58 L274 66 Q282 66 290 66 Z" fill="#000" opacity="0.35" filter={`url(#${id}-soft)`} />
      {/* Hauptband */}
      <path d={bandPath} fill={`url(#${id}-band)`} filter={`url(#${id}-grain)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="28" y="0" width="40" height="84" fill={`url(#${id}-hatch)`} opacity="0.5" />
        <rect x="252" y="0" width="40" height="84" fill={`url(#${id}-hatch)`} opacity="0.5" />
        <path d={bandPath} fill={`url(#${id}-curve)`} />
      </g>
      {/* Goldkanten + Naht */}
      <path d="M28 26 Q160 6 292 26" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2.6" />
      <path d="M28 62 Q160 42 292 62" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2.6" />
      <path d="M34 31.5 Q160 12.5 286 31.5" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.9" strokeDasharray="3 2.5" />
      <path d="M34 57 Q160 38 286 57" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.9" strokeDasharray="3 2.5" />
      {/* Schrift folgt der Wölbung */}
      <text fontFamily="Figtree, Arial, sans-serif" fontWeight="900" fontSize="22" letterSpacing="4" fill="#000" opacity="0.45" transform="translate(1.2 2)">
        <textPath href={`#${id}-text`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
      <text fontFamily="Figtree, Arial, sans-serif" fontWeight="900" fontSize="22" letterSpacing="4" fill="#fff" stroke={shade(color, -0.75)} strokeWidth="1.2" paintOrder="stroke">
        <textPath href={`#${id}-text`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
    </svg>
  );
}

// ---------- Anfeuern: Flamme, Megafon, Blitz ----------

const FLAME_OUTER =
  'M50 6 C54 18 64 22 68 32 C71 26 70 21 68 17 C78 25 82 38 80 52 C78 68 67 79 50 80 C33 79 22 69 21 55 C20 44 26 36 33 30 C32 37 34 42 38 45 C37 32 42 18 50 6 Z';
const FLAME_MID = 'M51 28 C54 39 63 43 64 55 C65 66 58 75 50 75 C42 75 35 68 35 59 C35 51 40 46 44 42 C44 48 46 51 49 53 C47 44 48 36 51 28 Z';
const FLAME_CORE = 'M50 50 C53 56 57 59 57 65 C57 70 54 74 50 74 C46 74 43 70 43 66 C43 61 47 58 50 50 Z';
const BOLT = 'M60 5 L21 57 L46 57 L37 95 L80 39 L54 39 L65 5 Z';

function Flame({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-fire`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#e0241a" />
          <stop offset="0.45" stopColor="#ff6a00" />
          <stop offset="1" stopColor="#ffb000" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff4c0" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="#fff4c0" stopOpacity="0" />
          <stop offset="0.7" stopColor="#7a0a00" stopOpacity="0" />
          <stop offset="1" stopColor="#7a0a00" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${id}-mid`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffb400" />
          <stop offset="1" stopColor="#ffe98a" />
        </linearGradient>
        <linearGradient id={`${id}-bark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a4a28" />
          <stop offset="1" stopColor="#2e1a0c" />
        </linearGradient>
        <radialGradient id={`${id}-heat`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff8a1f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff8a1f" stopOpacity="0" />
        </radialGradient>
        <Glow id={`${id}-glow`} blur={3} color="#ff7a00" />
        <Blur id={`${id}-sh`} std={2} />
      </defs>
      <ellipse cx="50" cy="86" rx="40" ry="10" fill={`url(#${id}-heat)`} />
      <ellipse cx="53" cy="92" rx="30" ry="3.5" fill="#000" opacity="0.5" filter={`url(#${id}-sh)`} />
      {/* zwei Holzscheite */}
      <g>
        <g transform="rotate(8 50 86)">
          <rect x="22" y="81" width="50" height="9" rx="4.5" fill={`url(#${id}-bark)`} />
          <ellipse cx="72" cy="85.5" rx="3" ry="4.5" fill="#d9a56c" />
          <ellipse cx="72" cy="85.5" rx="1.6" ry="2.6" fill="none" stroke="#9a6a3a" strokeWidth="0.5" />
          <path d="M34 82 L40 84 M48 83 L55 85" stroke="#ff7a1a" strokeWidth="0.9" strokeLinecap="round" />
        </g>
        <g transform="rotate(-10 50 86)">
          <rect x="28" y="81" width="50" height="9" rx="4.5" fill={`url(#${id}-bark)`} />
          <ellipse cx="28" cy="85.5" rx="3" ry="4.5" fill="#e0b07a" />
          <ellipse cx="28" cy="85.5" rx="1.6" ry="2.6" fill="none" stroke="#9a6a3a" strokeWidth="0.5" />
          <path d="M44 82 L50 84 M58 82 L63 84" stroke="#ffb03a" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      </g>
      <path d={FLAME_OUTER} fill={`url(#${id}-fire)`} filter={`url(#${id}-glow)`} />
      <path d={FLAME_OUTER} fill={`url(#${id}-side)`} />
      <path d={FLAME_MID} fill={`url(#${id}-mid)`} />
      <path d={FLAME_CORE} fill="#fffbe8" />
      {/* Funken */}
      {[
        [30, 24, 1.1],
        [72, 14, 0.9],
        [62, 8, 0.7],
        [24, 40, 0.8],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#ffd27a" filter={`url(#${id}-glow)`} />
      ))}
    </>
  );
}

function Megaphone({ id }: { id: string }) {
  // Kegel: schmal links (x=20), Trichter rechts (x=72)
  const yTop = (x: number) => 44 - (18 / 52) * (x - 20);
  const yBot = (x: number) => 56 + (18 / 52) * (x - 20);
  const rad = (x: number) => (yBot(x) - yTop(x)) / 2;
  const band = (xa: number, xb: number) =>
    `M${f(xa)} ${f(yTop(xa))}A${f(rad(xa) / 3)} ${f(rad(xa))} 0 0 1 ${f(xa)} ${f(yBot(xa))}L${f(xb)} ${f(yBot(xb))}A${f(rad(xb) / 3)} ${f(rad(xb))} 0 0 0 ${f(xb)} ${f(yTop(xb))}Z`;
  return (
    <>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#ece7df" />
          <stop offset="0.8" stopColor="#a69f95" />
          <stop offset="1" stopColor="#c9c2b8" />
        </linearGradient>
        <linearGradient id={`${id}-red`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6a5e" />
          <stop offset="0.4" stopColor="#e0352b" />
          <stop offset="1" stopColor="#8c1710" />
        </linearGradient>
        <radialGradient id={`${id}-throat`} cx="0.62" cy="0.55" r="0.7">
          <stop offset="0" stopColor="#1a1512" />
          <stop offset="0.6" stopColor="#5a524b" />
          <stop offset="1" stopColor="#d9d2c8" />
        </radialGradient>
        <linearGradient id={`${id}-grip`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a4f55" />
          <stop offset="1" stopColor="#1c1f22" />
        </linearGradient>
        <Blur id={`${id}-sh`} std={2.2} />
      </defs>
      <ellipse cx="50" cy="92" rx="36" ry="4" fill="#000" opacity="0.5" filter={`url(#${id}-sh)`} />
      <g transform="translate(48 52) rotate(-16) scale(0.92) translate(-56 -50)">
        {/* Schallwellen */}
        {[30, 38, 46].map((r, i) => {
          const a = (32 * Math.PI) / 180;
          return (
            <path
              key={r}
              d={`M${f(72 + r * Math.cos(-a))} ${f(50 + r * Math.sin(-a))}A${r} ${r} 0 0 1 ${f(72 + r * Math.cos(a))} ${f(50 + r * Math.sin(a))}`}
              stroke="#ffd84d"
              strokeWidth={3 - i * 0.6}
              strokeOpacity={0.95 - i * 0.25}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
        {/* Griff */}
        <path d="M33 53 L40 51 L44 71 C44.5 74 37.5 75 37 72 Z" fill={`url(#${id}-grip)`} />
        <path d="M41 58 L46 58 L46 61 L42 61 Z" fill="#2a2e33" />
        {/* Mundstück */}
        <rect x="8" y="45" width="13" height="10" fill={`url(#${id}-grip)`} />
        <ellipse cx="8" cy="50" rx="1.8" ry="5" fill="#111" />
        {/* Kegel */}
        <path d={`M20 44 L72 26 L72 74 L20 56 Z`} fill={`url(#${id}-body)`} />
        <path d={band(46, 53)} fill={`url(#${id}-red)`} />
        <path d={band(60, 66)} fill={`url(#${id}-red)`} />
        <path d={`M21 44.6 L71 27.4`} stroke="#fff" strokeWidth="1.2" strokeOpacity="0.9" />
        {/* Trichter-Öffnung mit Blick hinein */}
        <ellipse cx="72" cy="50" rx="8.5" ry="24.5" fill="#f4f0ea" stroke="#8a8278" strokeWidth="0.6" />
        <ellipse cx="72.8" cy="50" rx="6.6" ry="21.5" fill={`url(#${id}-throat)`} />
        <path d="M66.5 36 C66 42 66 56 67 63" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" fill="none" />
      </g>
    </>
  );
}

function Bolt({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff7b8" />
          <stop offset="0.4" stopColor="#ffd21f" />
          <stop offset="1" stopColor="#ff9f00" />
        </linearGradient>
        <linearGradient id={`${id}-hi`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="0.4" stopColor="#fffdf0" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={BOLT} />
        </clipPath>
        <Blur id={`${id}-glow`} std={4} />
        <Blur id={`${id}-sh`} std={2.2} />
      </defs>
      <ellipse cx="50" cy="96" rx="22" ry="3" fill="#000" opacity="0.5" filter={`url(#${id}-sh)`} />
      <path d={BOLT} fill="#ffd21f" opacity="0.55" filter={`url(#${id}-glow)`} />
      {/* Materialstärke */}
      {[6, 5, 4, 3, 2, 1].map((i) => (
        <path key={i} d={BOLT} fill={i > 3 ? '#6e3a00' : '#a85f00'} transform={`translate(${0.8 * i} ${1 * i})`} />
      ))}
      <path d={BOLT} fill={`url(#${id}-face)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {/* Mittelgrat: rechte Facette dunkler */}
        <path d="M62.5 5 L65 5 L54 39 L80 39 L37 95 L49.5 47 Z" fill="#7a3d00" opacity="0.22" />
        <path d={BOLT} fill="none" stroke={`url(#${id}-hi)`} strokeWidth="2.4" transform="translate(-0.7 -0.7)" />
        <path d={BOLT} fill="none" stroke="#7a3d00" strokeOpacity="0.5" strokeWidth="1.4" transform="translate(0.8 0.8)" />
      </g>
      <path d={BOLT} fill="none" stroke="#7a3d00" strokeWidth="0.6" strokeLinejoin="round" />
      {/* kleine Entladungen */}
      <path d="M84 30 L88 33 L85 35 L90 39 M16 62 L12 64 L15 66 L10 70" stroke="#fff3a0" strokeWidth="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const CHEER_LABEL: Record<CheerKind, string> = { flame: 'Flamme', horn: 'Megafon', bolt: 'Blitz' };

export function CheerSticker({ kind, size = 56, className, style }: ArtProps & { kind: CheerKind }) {
  const id = useSvgId('chr');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={{ overflow: 'visible', ...style }} role="img" aria-label={`Anfeuern: ${CHEER_LABEL[kind]}`}>
      {kind === 'flame' && <Flame id={id} />}
      {kind === 'horn' && <Megaphone id={id} />}
      {kind === 'bolt' && <Bolt id={id} />}
    </svg>
  );
}
