import { useId } from 'react';

/**
 * Metall-Platzierungen: Gold, Silber, Bronze – mit Verlauf, Körnung (Textur),
 * Prägekante und einem Glanzstreifen, der langsam darüberläuft.
 * Alles als SVG, damit es auf jedem Bildschirm gestochen scharf ist.
 */

type Metal = 'gold' | 'silver' | 'bronze';

const PALETTE: Record<Metal, { stops: string[]; edge: string; deep: string; glow: string }> = {
  gold: {
    stops: ['#fff1a8', '#ffd23f', '#e8a20c', '#965f05', '#ffc928', '#6f4504', '#ffdd6b'],
    edge: '#6e4706',
    deep: '#3d2600',
    glow: 'rgba(255, 196, 40, 0.55)',
  },
  silver: {
    stops: ['#ffffff', '#eef2f6', '#b8c2cc', '#7c8792', '#e4e9ee', '#69737d', '#f4f7fa'],
    edge: '#4a535c',
    deep: '#22282e',
    glow: 'rgba(210, 222, 235, 0.45)',
  },
  bronze: {
    stops: ['#ffe6cc', '#f3b27a', '#c87533', '#8a4a1a', '#e59a5c', '#6e3610', '#f7c495'],
    edge: '#4f260a',
    deep: '#2a1203',
    glow: 'rgba(230, 140, 70, 0.45)',
  },
};

export const metalFor = (place: number): Metal | null => (place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : null);

function Defs({ id, metal }: { id: string; metal: Metal }) {
  const p = PALETTE[metal];
  const offsets = [0, 0.18, 0.38, 0.52, 0.66, 0.84, 1];
  return (
    <defs>
      {/* Metallverlauf mit mehreren Lichtkanten */}
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0.9" y2="1">
        {p.stops.map((c, i) => (
          <stop key={i} offset={offsets[i]} stopColor={c} />
        ))}
      </linearGradient>
      <radialGradient id={`${id}-disc`} cx="0.35" cy="0.3" r="0.85">
        <stop offset="0" stopColor={p.stops[1]} />
        <stop offset="0.45" stopColor={p.stops[2]} />
        <stop offset="0.8" stopColor={p.stops[3]} />
        <stop offset="1" stopColor={p.edge} />
      </radialGradient>
      {/* Glanzstreifen, der über die Zahl wandert */}
      <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0.35" gradientUnits="objectBoundingBox">
        <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
        <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
        <animateTransform attributeName="gradientTransform" type="translate" from="-1.2 0" to="1.2 0" dur="3.2s" repeatCount="indefinite" />
      </linearGradient>
      {/* Körnung: feines Rauschen, nur innerhalb der Form, leicht eingerieben */}
      <filter id={`${id}-grain`} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" result="dark" />
        <feComposite in="dark" in2="SourceGraphic" operator="in" result="grainIn" />
        <feBlend in="SourceGraphic" in2="grainIn" mode="multiply" />
      </filter>
      {/* Prägung: Kante oben hell, unten dunkel */}
      <filter id={`${id}-emboss`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur" />
        <feSpecularLighting in="blur" surfaceScale="4" specularConstant="0.9" specularExponent="22" lightingColor="#ffffff" result="spec">
          <feDistantLight azimuth="235" elevation="48" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
        <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.38" k4="0" />
      </filter>
    </defs>
  );
}

/** Große, freistehende Metall-Zahl (z. B. auf dem Podest) */
export function MetalNumeral({ place, size = 96 }: { place: number; size?: number }) {
  const metal = metalFor(place) ?? 'silver';
  const raw = useId();
  const id = `m${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  const p = PALETTE[metal];
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 80 100" aria-label={`Platz ${place}`} style={{ filter: `drop-shadow(0 6px 14px ${p.glow})` }}>
      <Defs id={id} metal={metal} />
      {/* Schattenkörper (Tiefe) */}
      <text x="41.5" y="85" textAnchor="middle" fontSize="92" fontWeight="900" fontFamily="Figtree, Arial, sans-serif" fill={p.deep}>
        {place}
      </text>
      {/* Metall mit Körnung und Prägung */}
      <g filter={`url(#${id}-emboss)`}>
        <text
          x="40"
          y="82"
          textAnchor="middle"
          fontSize="92"
          fontWeight="900"
          fontFamily="Figtree, Arial, sans-serif"
          fill={`url(#${id}-metal)`}
          stroke={p.edge}
          strokeWidth="1.6"
          paintOrder="stroke"
          filter={`url(#${id}-grain)`}
        >
          {place}
        </text>
      </g>
      {/* Glanz */}
      <text x="40" y="82" textAnchor="middle" fontSize="92" fontWeight="900" fontFamily="Figtree, Arial, sans-serif" fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }}>
        {place}
      </text>
    </svg>
  );
}

/** Runde Medaille mit Metall-Zahl (für die Rangliste) */
export function Medal({ place, size = 44 }: { place: number; size?: number }) {
  const metal = metalFor(place);
  const raw = useId();
  const id = `d${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!metal) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-full bg-white/[0.08] font-black text-sp-sub"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {place}
      </div>
    );
  }
  const p = PALETTE[metal];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={`Platz ${place}`} className="shrink-0" style={{ filter: `drop-shadow(0 3px 8px ${p.glow})` }}>
      <Defs id={id} metal={metal} />
      <circle cx="50" cy="50" r="47" fill={p.edge} />
      <circle cx="50" cy="50" r="44" fill={`url(#${id}-disc)`} filter={`url(#${id}-grain)`} />
      <circle cx="50" cy="50" r="36" fill="none" stroke={p.stops[0]} strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="50" cy="50" r="33.5" fill="none" stroke={p.edge} strokeOpacity="0.45" strokeWidth="1.5" />
      <g filter={`url(#${id}-emboss)`}>
        <text
          x="50"
          y="69"
          textAnchor="middle"
          fontSize="54"
          fontWeight="900"
          fontFamily="Figtree, Arial, sans-serif"
          fill={`url(#${id}-metal)`}
          stroke={p.edge}
          strokeWidth="2"
          paintOrder="stroke"
        >
          {place}
        </text>
      </g>
      <circle cx="50" cy="50" r="44" fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}
