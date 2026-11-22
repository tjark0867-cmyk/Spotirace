/** Eigenes Spotirace-Logo: Soundwellen als "Speed-Lines" + Zielflagge */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="32" fill="#1ed760" />
      <g fill="#000">
        <rect x="13" y="26" width="6" height="16" rx="3" transform="skewX(-14)" />
        <rect x="23" y="18" width="6" height="28" rx="3" transform="skewX(-14)" />
        <rect x="33" y="22" width="6" height="22" rx="3" transform="skewX(-14)" />
        <rect x="43" y="30" width="6" height="12" rx="3" transform="skewX(-14)" />
      </g>
    </svg>
  );
}

export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="font-extrabold tracking-tight" style={{ fontSize: size * 0.72 }}>
        Spotirace
      </span>
    </div>
  );
}
