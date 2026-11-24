import type { CSSProperties } from 'react';
import { TEAM_COLORS, TEAM_NAMES, type CheerKind, type TeamId } from '../../../../shared/types';
import { Emboss, Glow, Grain, GOLD_STOPS, MetalGradient, Shine, shade, useSvgId } from './defs';

/**
 * Team-Staffel: Wappen, Staffelstab, Wechselzonen-Banner, Anfeuer-Sticker.
 * Alles selbst gezeichnete SVGs im Stil von Medaillen und Krone.
 */

interface ArtProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// ---------- Team-Wappen ----------

const CREST = 'M50 5 L87 13 L87 45 C87 70 71 86 50 96 C29 86 13 70 13 45 L13 13 Z';
const FIELD = 'M50 12 L80 18.5 L80 45 C80 66 67 80 50 88.5 C33 80 20 66 20 45 L20 18.5 Z';
const BARS = [10, 22, 34, 44, 34, 22, 10];

export function TeamCrest({ team, size = 64, className, style }: ArtProps & { team: TeamId }) {
  const id = useSvgId('crs');
  const color = TEAM_COLORS[team];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} role="img" aria-label={`Wappen ${TEAM_NAMES[team]}`}>
      <defs>
        <MetalGradient id={`${id}-gold`} stops={GOLD_STOPS} />
        <linearGradient id={`${id}-field`} x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0" stopColor={shade(color, 0.35)} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.6)} />
        </linearGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={shade(color, 0.55)} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={FIELD} />
        </clipPath>
        <Grain id={`${id}-grain`} freq={1.5} amount={0.45} seed={6} />
        <Emboss id={`${id}-emboss`} strength={0.42} />
        <Shine id={`${id}-shine`} opacity={0.75} dur={4.2} />
      </defs>
      <path d={CREST} fill="#000" opacity="0.45" transform="translate(0 2.5)" />
      <g filter={`url(#${id}-emboss)`}>
        <path d={CREST} fill={`url(#${id}-gold)`} stroke="#6e4706" strokeWidth="1.3" strokeLinejoin="round" filter={`url(#${id}-grain)`} />
      </g>
      <path d={FIELD} fill={`url(#${id}-field)`} stroke={shade(color, -0.7)} strokeWidth="1" filter={`url(#${id}-grain)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {/* Schildhaupt */}
        <rect x="0" y="0" width="100" height="29" fill={shade(color, -0.45)} />
        <rect x="0" y="28.4" width="100" height="1.4" fill="#ffe08a" opacity="0.9" />
        {/* rechte Hälfte leicht dunkler → Wölbung */}
        <rect x="50" y="0" width="50" height="100" fill="#000" opacity="0.12" />
      </g>
      {/* Stern im Schildhaupt */}
      <path d="M50 16.5 C50.8 20.4 51.6 21.2 55.5 22 C51.6 22.8 50.8 23.6 50 27.5 C49.2 23.6 48.4 22.8 44.5 22 C48.4 21.2 49.2 20.4 50 16.5 Z" fill={`url(#${id}-gold)`} stroke="#6e4706" strokeWidth="0.5" />
      {/* Soundwelle */}
      <g filter={`url(#${id}-emboss)`}>
        {BARS.map((h, i) => (
          <rect key={i} x={23.3 + i * 8} y={57 - h / 2} width="5.4" height={h} rx="2.7" fill={`url(#${id}-bar)`} stroke={shade(color, -0.6)} strokeWidth="0.6" />
        ))}
      </g>
      <path d={CREST} fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

// ---------- Staffelstab ----------

export function Baton({ size = 64, className, style, motion = false }: ArtProps & { motion?: boolean }) {
  const id = useSvgId('btn');
  const stripes = [0, 1, 2, 3, 4, 5];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={{ overflow: 'visible', ...style }} role="img" aria-label="Staffelstab">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.22" stopColor="#e3e9ee" />
          <stop offset="0.55" stopColor="#9aa5af" />
          <stop offset="0.85" stopColor="#59636c" />
          <stop offset="1" stopColor="#87919a" />
        </linearGradient>
        <linearGradient id={`${id}-cap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d0d7de" />
          <stop offset="0.3" stopColor="#7b858f" />
          <stop offset="0.7" stopColor="#2f363c" />
          <stop offset="1" stopColor="#59626a" />
        </linearGradient>
        <linearGradient id={`${id}-round`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </linearGradient>
        <clipPath id={`${id}-body`}>
          <rect x="8" y="41" width="84" height="18" rx="9" />
        </clipPath>
        <Grain id={`${id}-grain`} freq={1.8} amount={0.4} seed={12} />
        <Shine id={`${id}-shine`} opacity={0.9} dur={2.6} />
      </defs>
      <g transform="rotate(-28 50 50)">
        {motion && (
          <g stroke="#fff" strokeLinecap="round" opacity="0.55">
            <path d="M-8 44 H2" strokeWidth="1.6" />
            <path d="M-16 50 H0" strokeWidth="2" />
            <path d="M-6 56 H3" strokeWidth="1.4" />
          </g>
        )}
        <ellipse cx="50" cy="66" rx="40" ry="3.5" fill="#000" opacity="0.3" />
        <g clipPath={`url(#${id}-body)`} filter={`url(#${id}-grain)`}>
          <rect x="8" y="41" width="84" height="18" fill={`url(#${id}-metal)`} />
          {stripes.map((i) => {
            const x = 22 + i * 10.5;
            return <path key={i} d={`M${x} 41 H${x + 5.5} L${x + 1.5} 59 H${x - 4} Z`} fill={i % 2 ? TEAM_COLORS.pink : TEAM_COLORS.green} />;
          })}
          <rect x="8" y="41" width="84" height="18" fill={`url(#${id}-round)`} />
          <rect x="8" y="41" width="9" height="18" fill={`url(#${id}-cap)`} />
          <rect x="83" y="41" width="9" height="18" fill={`url(#${id}-cap)`} />
          <rect x="16.4" y="41" width="1.2" height="18" fill="#fff" opacity="0.5" />
          <rect x="82.4" y="41" width="1.2" height="18" fill="#fff" opacity="0.5" />
        </g>
        <rect x="8" y="41" width="84" height="18" rx="9" fill="none" stroke="#2c3238" strokeWidth="1" />
        <path d="M14 45 H86" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.3" strokeLinecap="round" />
        <rect x="8" y="41" width="84" height="18" rx="9" fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
      </g>
    </svg>
  );
}

// ---------- Wechselzonen-Banner ----------

export function ZoneBanner({ team, label = 'WECHSELZONE', width = 300, className }: { team: TeamId; label?: string; width?: number; className?: string }) {
  const id = useSvgId('zb');
  const color = TEAM_COLORS[team];
  return (
    <svg width={width} height={width * (72 / 320)} viewBox="0 0 320 72" className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 0.3)} />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.45)} />
        </linearGradient>
        <MetalGradient id={`${id}-gold`} stops={GOLD_STOPS} x2={1} y2={0.2} />
        <pattern id={`${id}-hatch`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="6" height="12" fill="#fff" opacity="0.9" />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <rect x="34" y="10" width="252" height="44" rx="3" />
        </clipPath>
        <Grain id={`${id}-grain`} freq={1.2} amount={0.4} seed={3} />
        <Shine id={`${id}-shine`} opacity={0.6} dur={3} />
      </defs>
      {/* Schwalbenschwänze */}
      {[
        { d: 'M2 22 H40 V66 H2 L14 44 Z', fold: 'M34 54 L40 66 L40 54 Z' },
        { d: 'M318 22 H280 V66 H318 L306 44 Z', fold: 'M286 54 L280 66 L280 54 Z' },
      ].map((t, i) => (
        <g key={i}>
          <path d={t.d} fill={shade(color, -0.4)} filter={`url(#${id}-grain)`} />
          <path d={t.fold} fill={shade(color, -0.75)} />
        </g>
      ))}
      <g filter={`url(#${id}-grain)`}>
        <rect x="34" y="10" width="252" height="44" rx="3" fill={`url(#${id}-band)`} />
        <g clipPath={`url(#${id}-clip)`}>
          <rect x="34" y="10" width="38" height="44" fill={`url(#${id}-hatch)`} opacity="0.55" />
          <rect x="248" y="10" width="38" height="44" fill={`url(#${id}-hatch)`} opacity="0.55" />
        </g>
      </g>
      <rect x="34" y="10" width="252" height="3" fill={`url(#${id}-gold)`} />
      <rect x="34" y="51" width="252" height="3" fill={`url(#${id}-gold)`} />
      <text
        x="160"
        y="41"
        textAnchor="middle"
        fontFamily="Figtree, Arial, sans-serif"
        fontWeight="900"
        fontSize="23"
        letterSpacing="4"
        fill="#fff"
        stroke={shade(color, -0.75)}
        strokeWidth="3"
        paintOrder="stroke"
      >
        {label}
      </text>
      <rect x="34" y="10" width="252" height="44" rx="3" fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

// ---------- Anfeuer-Sticker ----------

const FLAME_OUTER = 'M50 7 C57 24 76 30 76 55 C76 76 64 90 50 90 C36 90 24 77 24 58 C24 45 31 36 38 30 C38 41 42 47 47 49 C43 35 45 19 50 7 Z';
const FLAME_INNER = 'M51 39 C55 50 64 54 64 67 C64 77 58 84 50 84 C42 84 37 77 37 69 C37 60 42 56 46 52 C47 58 49 60 52 61 C50 54 49 47 51 39 Z';
const FLAME_CORE = 'M50 60 C53 66 57 68 57 74 C57 79 54 82 50 82 C46 82 43 79 43 75 C43 70 47 68 50 60 Z';
const BOLT = 'M60 5 L21 57 L46 57 L37 95 L80 39 L54 39 L65 5 Z';
const THUMB_PARTS = {
  sleeve: 'M12 47 H32 V91 H12 Z',
  fist: 'M30 46 H62 C70 46 74 52 74 58 V80 C74 87 69 91 62 91 H30 Z',
  thumb: 'M33 48 C32 36 34 22 40 13 C44 7 54 8 54 17 C54 26 50 34 52 46 Z',
  fingers: [44, 55, 66, 77].map((y) => `M50 ${y} H80 C83 ${y} 85 ${y + 2.3} 85 ${y + 5} C85 ${y + 7.7} 83 ${y + 10} 80 ${y + 10} H50 Z`),
};

export function CheerSticker({ kind, size = 56, className, style }: ArtProps & { kind: CheerKind }) {
  const id = useSvgId('stk');
  const label = kind === 'flame' ? 'Flamme' : kind === 'thumb' ? 'Daumen hoch' : 'Blitz';
  const shapes: string[] = kind === 'flame' ? [FLAME_OUTER] : kind === 'bolt' ? [BOLT] : [THUMB_PARTS.sleeve, THUMB_PARTS.fist, THUMB_PARTS.thumb, ...THUMB_PARTS.fingers];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={{ overflow: 'visible', ...style }} role="img" aria-label={`Sticker: ${label}`}>
      <defs>
        <linearGradient id={`${id}-fire`} x1="0" y1="1" x2="0.2" y2="0">
          <stop offset="0" stopColor="#ff2d55" />
          <stop offset="0.5" stopColor="#ff6a00" />
          <stop offset="1" stopColor="#ffb000" />
        </linearGradient>
        <linearGradient id={`${id}-fireIn`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#fff3b0" />
        </linearGradient>
        <linearGradient id={`${id}-bolt`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff7b0" />
          <stop offset="0.4" stopColor="#ffe14d" />
          <stop offset="1" stopColor="#ff9f00" />
        </linearGradient>
        <linearGradient id={`${id}-hand`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#ffe9a6" />
          <stop offset="0.5" stopColor="#ffc864" />
          <stop offset="1" stopColor="#e39a2a" />
        </linearGradient>
        <linearGradient id={`${id}-sleeve`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7fb6ff" />
          <stop offset="1" stopColor="#2d6fd6" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.65" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.46" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          {shapes.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <Grain id={`${id}-grain`} freq={1.6} amount={0.35} seed={14} />
        <Glow id={`${id}-glow`} blur={3} color={kind === 'bolt' ? '#ffe14d' : kind === 'flame' ? '#ff6a00' : '#ffc864'} />
      </defs>
      {/* weißer Sticker-Rand mit Schatten */}
      <g style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.5))' }}>
        {shapes.map((d, i) => (
          <path key={i} d={d} fill="#fff" stroke="#fff" strokeWidth="11" strokeLinejoin="round" />
        ))}
      </g>
      <g filter={`url(#${id}-grain)`}>
        {kind === 'flame' && (
          <>
            <path d={FLAME_OUTER} fill={`url(#${id}-fire)`} stroke="#b3122f" strokeWidth="1.4" strokeLinejoin="round" />
            <path d={FLAME_INNER} fill={`url(#${id}-fireIn)`} />
            <path d={FLAME_CORE} fill="#fffbe6" />
          </>
        )}
        {kind === 'bolt' && (
          <>
            <path d={BOLT} fill={`url(#${id}-bolt)`} stroke="#b36b00" strokeWidth="1.6" strokeLinejoin="round" filter={`url(#${id}-glow)`} />
            <path d="M58 12 L31 51 L39 51" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {kind === 'thumb' && (
          <g stroke="#7a4f06" strokeWidth="1.5" strokeLinejoin="round">
            <path d={THUMB_PARTS.sleeve} fill={`url(#${id}-sleeve)`} stroke="#1d4c99" />
            <path d={THUMB_PARTS.fist} fill={`url(#${id}-hand)`} />
            {THUMB_PARTS.fingers.map((d, i) => (
              <path key={i} d={d} fill={`url(#${id}-hand)`} />
            ))}
            <path d={THUMB_PARTS.thumb} fill={`url(#${id}-hand)`} />
            <path d="M13.5 52 H30.5" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" />
          </g>
        )}
      </g>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="0" y="0" width="100" height="100" fill={`url(#${id}-gloss)`} />
      </g>
    </svg>
  );
}
