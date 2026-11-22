import { useEffect, useState } from 'react';

function hashHue(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function seedColor(seed: string): string {
  return `hsl(${hashHue(seed)} 45% 32%)`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const colorCache = new Map<string, string>();

/**
 * Ermittelt die dominante Farbe eines Bildes (für den Farbverlauf im Header,
 * wie bei Spotify). Fällt auf eine Farbe aus dem Seed zurück, falls das Bild
 * keine CORS-Header hat.
 */
export function useDominantColor(url: string | null | undefined, seed: string): string {
  const [color, setColor] = useState(() => (url && colorCache.get(url)) || seedColor(seed));

  useEffect(() => {
    if (!url) {
      setColor(seedColor(seed));
      return;
    }
    const known = colorCache.get(url);
    if (known) {
      setColor(known);
      return;
    }
    setColor(seedColor(seed));
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0, g = 0, b = 0, weight = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          if (l < 0.08 || l > 0.95) continue;
          const w = 0.15 + s * (1 - Math.abs(l - 0.5));
          r += data[i] * w;
          g += data[i + 1] * w;
          b += data[i + 2] * w;
          weight += w;
        }
        if (weight === 0) return;
        const [h, s] = rgbToHsl(r / weight, g / weight, b / weight);
        const result = `hsl(${Math.round(h)} ${Math.round(Math.min(s, 0.65) * 100)}% ${s < 0.1 ? 28 : 34}%)`;
        colorCache.set(url, result);
        setColor(result);
      } catch {
        /* Canvas "tainted" – Fallback-Farbe bleibt */
      }
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url, seed]);

  return color;
}
