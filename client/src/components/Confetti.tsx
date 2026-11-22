import { useMemo, type CSSProperties } from 'react';

const COLORS = ['#1ed760', '#ffffff', '#f573a0', '#509bf5', '#ffc864', '#ff6437'];

export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        dx: (Math.random() - 0.5) * 240,
        rot: 360 + Math.random() * 720,
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
      })),
    [pieces],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {items.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--dx': `${p.dx}px`,
              '--rot': `${p.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
