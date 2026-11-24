import { useId } from 'react';

/** Kurze, eindeutige SVG-IDs pro Instanz */
function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

function GoldDefs({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.85" y2="1">
        <stop offset="0" stopColor="#fff1a8" />
        <stop offset="0.2" stopColor="#ffd23f" />
        <stop offset="0.42" stopColor="#e8a20c" />
        <stop offset="0.55" stopColor="#965f05" />
        <stop offset="0.7" stopColor="#ffc928" />
        <stop offset="0.88" stopColor="#7a4f06" />
        <stop offset="1" stopColor="#ffdd6b" />
      </linearGradient>
      <filter id={`${id}-grain`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" result="d" />
        <feComposite in="d" in2="SourceGraphic" operator="in" result="g" />
        <feBlend in="SourceGraphic" in2="g" mode="multiply" />
      </filter>
      <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0.38" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
        <stop offset="0.62" stopColor="#fff" stopOpacity="0" />
        <animateTransform attributeName="gradientTransform" type="translate" from="-1.3 0" to="1.3 0" dur="3.6s" repeatCount="indefinite" />
      </linearGradient>
    </>
  );
}

/** Goldene Krone mit Edelsteinen und Perlenband */
export function Crown({ width = 64 }: { width?: number }) {
  const id = useSvgId('cr');
  const shape = 'M6 38 L4 12 L18 24 L32 4 L46 24 L60 12 L58 38 Z';
  return (
    <svg width={width} height={width * 0.75} viewBox="0 0 64 48" aria-hidden style={{ filter: 'drop-shadow(0 4px 10px rgba(255,200,60,.55))' }}>
      <defs>
        <GoldDefs id={id} />
        <radialGradient id={`${id}-ruby`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffb3c1" />
          <stop offset="0.45" stopColor="#e0113a" />
          <stop offset="1" stopColor="#5c0015" />
        </radialGradient>
        <radialGradient id={`${id}-sapphire`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#b8d8ff" />
          <stop offset="0.45" stopColor="#1f5fd6" />
          <stop offset="1" stopColor="#0a2160" />
        </radialGradient>
      </defs>
      <path d={shape} fill="#6e4706" transform="translate(0 1.5)" />
      <path d={shape} fill={`url(#${id}-gold)`} stroke="#7a4f06" strokeWidth="1.2" strokeLinejoin="round" filter={`url(#${id}-grain)`} />
      <rect x="5" y="36" width="54" height="9" rx="2.5" fill={`url(#${id}-gold)`} stroke="#7a4f06" strokeWidth="1.2" filter={`url(#${id}-grain)`} />
      {[11, 18, 25, 32, 39, 46, 53].map((x) => (
        <circle key={x} cx={x} cy="40.5" r="1.9" fill="#fff8e1" stroke="#b8860b" strokeWidth="0.5" />
      ))}
      <circle cx="4" cy="11" r="3" fill={`url(#${id}-sapphire)`} />
      <circle cx="60" cy="11" r="3" fill={`url(#${id}-sapphire)`} />
      <circle cx="32" cy="4" r="3.6" fill={`url(#${id}-ruby)`} />
      <ellipse cx="32" cy="27" rx="4.2" ry="5.4" fill={`url(#${id}-ruby)`} stroke="#7a4f06" strokeWidth="0.8" />
      <circle cx="18" cy="29" r="2.6" fill={`url(#${id}-sapphire)`} stroke="#7a4f06" strokeWidth="0.6" />
      <circle cx="46" cy="29" r="2.6" fill={`url(#${id}-sapphire)`} stroke="#7a4f06" strokeWidth="0.6" />
      <path d={shape} fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

/** Goldener Thron mit rotem Samt – der Sieger sitzt davor */
export function Throne({ width = 150 }: { width?: number }) {
  const id = useSvgId('th');
  // Rückenlehne mit drei Spitzen oben
  const back =
    'M22 150 L22 46 C22 34 30 30 36 26 L46 10 L56 24 L70 2 L84 24 L94 10 L104 26 C110 30 118 34 118 46 L118 150 Z';
  const velvet = 'M34 140 L34 52 C34 44 40 40 46 37 L70 24 L94 37 C100 40 106 44 106 52 L106 140 Z';
  return (
    <svg width={width} height={width * 1.25} viewBox="0 0 140 175" aria-hidden>
      <defs>
        <GoldDefs id={id} />
        <radialGradient id={`${id}-velvet`} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#c0183f" />
          <stop offset="0.55" stopColor="#7d0b28" />
          <stop offset="1" stopColor="#3a0412" />
        </radialGradient>
        {/* Steppung im Samt */}
        <pattern id={`${id}-tuft`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 6 H12 M6 0 V12" stroke="#000" strokeOpacity="0.22" strokeWidth="0.8" />
          <circle cx="6" cy="6" r="1.1" fill="#ffd23f" fillOpacity="0.55" />
        </pattern>
      </defs>
      {/* Rückenlehne */}
      <path d={back} fill="#5a3a04" transform="translate(2 3)" />
      <path d={back} fill={`url(#${id}-gold)`} stroke="#6e4706" strokeWidth="1.5" strokeLinejoin="round" filter={`url(#${id}-grain)`} />
      <path d={velvet} fill={`url(#${id}-velvet)`} />
      <path d={velvet} fill={`url(#${id}-tuft)`} />
      <path d={velvet} fill="none" stroke="#ffe08a" strokeOpacity="0.6" strokeWidth="1.2" />
      {/* Edelsteine auf den Spitzen */}
      <circle cx="70" cy="4" r="4" fill="#e0113a" stroke="#6e4706" strokeWidth="1" />
      <circle cx="46" cy="11" r="3" fill="#1f5fd6" stroke="#6e4706" strokeWidth="1" />
      <circle cx="94" cy="11" r="3" fill="#1f5fd6" stroke="#6e4706" strokeWidth="1" />
      {/* Armlehnen */}
      {[8, 112].map((x) => (
        <g key={x}>
          <rect x={x} y="104" width="20" height="50" rx="5" fill={`url(#${id}-gold)`} stroke="#6e4706" strokeWidth="1.2" filter={`url(#${id}-grain)`} />
          <circle cx={x + 10} cy="102" r="8" fill={`url(#${id}-gold)`} stroke="#6e4706" strokeWidth="1.2" />
        </g>
      ))}
      {/* Sitz */}
      <path d="M14 150 L126 150 L132 172 L8 172 Z" fill={`url(#${id}-gold)`} stroke="#6e4706" strokeWidth="1.5" filter={`url(#${id}-grain)`} />
      <rect x="26" y="140" width="88" height="12" rx="6" fill={`url(#${id}-velvet)`} />
      <path d={back} fill={`url(#${id}-shine)`} style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}
