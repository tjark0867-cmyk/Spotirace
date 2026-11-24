/** Eigenes Spotirace-Logo: Soundwellen als "Speed-Lines" + Zielflagge */
export function LogoMark({ size = 32, animated = false }: { size?: number; animated?: boolean }) {
  const bars = [
    { x: 13, y: 26, h: 16, d: '0s' },
    { x: 23, y: 18, h: 28, d: '-0.35s' },
    { x: 33, y: 22, h: 22, d: '-0.7s' },
    { x: 43, y: 30, h: 12, d: '-0.2s' },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="32" fill="#1ed760" />
      <g fill="#000" transform="skewX(-14)">
        {bars.map((b) => (
          <rect
            key={b.x}
            x={b.x}
            y={b.y}
            width="6"
            height={b.h}
            rx="3"
            className={animated ? 'animate-eq' : undefined}
            style={animated ? { transformBox: 'fill-box', transformOrigin: 'center', animationDelay: b.d } : undefined}
          />
        ))}
      </g>
    </svg>
  );
}

export function Logo({ size = 32, className = '', animated = false }: { size?: number; className?: string; animated?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} animated={animated} />
      <span className="font-extrabold tracking-tight" style={{ fontSize: size * 0.72 }}>
        Spotirace
      </span>
    </div>
  );
}
