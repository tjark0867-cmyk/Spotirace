import { useId } from 'react';

/**
 * Bausteine für die selbst gezeichneten SVG-Grafiken (gleicher Stil wie Medaillen und Krone):
 * Verläufe, feine Körnung, Prägekante, wandernder Glanz.
 */

/** Kurze, eindeutige SVG-IDs pro Instanz */
export function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/** Feine Körnung, nur innerhalb der Form, leicht eingerieben */
export function Grain({ id, freq = 1.5, amount = 0.5, seed = 4 }: { id: string; freq?: number | string; amount?: number; seed?: number }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="2" seed={seed} result="noise" />
      <feColorMatrix in="noise" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${amount} 0`} result="dark" />
      <feComposite in="dark" in2="SourceGraphic" operator="in" result="grainIn" />
      <feBlend in="SourceGraphic" in2="grainIn" mode="multiply" />
    </filter>
  );
}

/** Holzmaserung: Rauschen in die Länge gezogen */
export function WoodGrain({ id, seed = 2 }: { id: string; seed?: number }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035 0.55" numOctaves="3" seed={seed} result="noise" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.05  0 0 0 0 0  0 0 0 0.75 -0.12" result="streaks" />
      <feComposite in="streaks" in2="SourceGraphic" operator="in" result="grainIn" />
      <feBlend in="SourceGraphic" in2="grainIn" mode="multiply" />
    </filter>
  );
}

/** Prägung: Kante oben hell, unten dunkel */
export function Emboss({ id, strength = 0.38, blur = 1.2, scale = 4 }: { id: string; strength?: number; blur?: number; scale?: number }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="blur" />
      <feSpecularLighting in="blur" surfaceScale={scale} specularConstant="0.9" specularExponent="22" lightingColor="#ffffff" result="spec">
        <feDistantLight azimuth="235" elevation="48" />
      </feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
      <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3={strength} k4="0" />
    </filter>
  );
}

/** Glanzstreifen, der langsam über die Form wandert */
export function Shine({ id, dur = 3.6, opacity = 0.75, animate = true }: { id: string; dur?: number; opacity?: number; animate?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.35" gradientUnits="objectBoundingBox">
      <stop offset="0.36" stopColor="#fff" stopOpacity="0" />
      <stop offset="0.5" stopColor="#fff" stopOpacity={opacity} />
      <stop offset="0.64" stopColor="#fff" stopOpacity="0" />
      {animate && <animateTransform attributeName="gradientTransform" type="translate" from="-1.3 0" to="1.3 0" dur={`${dur}s`} repeatCount="indefinite" />}
    </linearGradient>
  );
}

/** Weiches Leuchten um die Form */
export function Glow({ id, blur = 2, color }: { id: string; blur?: number; color?: string }) {
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
      {color && <feFlood floodColor={color} result="c" />}
      {color && <feComposite in="c" in2="b" operator="in" result="b" />}
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

export const GOLD_STOPS = ['#fff1a8', '#ffd23f', '#e8a20c', '#965f05', '#ffc928', '#6f4504', '#ffdd6b'];
export const SILVER_STOPS = ['#ffffff', '#eef2f6', '#b8c2cc', '#7c8792', '#e4e9ee', '#69737d', '#f4f7fa'];
const OFFSETS = [0, 0.18, 0.38, 0.52, 0.66, 0.84, 1];

export function MetalGradient({ id, stops = GOLD_STOPS, x2 = 0.9, y2 = 1 }: { id: string; stops?: string[]; x2?: number; y2?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
      {stops.map((c, i) => (
        <stop key={i} offset={OFFSETS[i]} stopColor={c} />
      ))}
    </linearGradient>
  );
}

// ---------- Farben ----------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** amount > 0 → heller (Richtung Weiß), < 0 → dunkler (Richtung Schwarz) */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (t - c) * p);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Kleiner deterministischer Zufall (für Frost-Ranken, Spritzer …) */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}
