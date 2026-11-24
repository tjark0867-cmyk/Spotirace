import { useState } from 'react';
import type { ArtistSummary } from '../../../shared/types';
import { seedColor } from '../lib/color';
import { useInked } from '../lib/ink';
import { InkSmear } from './art/Effects';
import { MusicNoteIcon } from './Icons';

/** Rundes Artist-Bild mit Initialen-Fallback */
export function ArtistImage({
  artist,
  size,
  className = '',
}: {
  artist: Pick<ArtistSummary, 'id' | 'name' | 'image'> & { imageSmall?: string | null };
  size: number;
  className?: string;
}) {
  // Kleine Avatare laden das kleinere Bild → viel weniger Daten
  const src = size <= 160 ? (artist.imageSmall ?? artist.image) : artist.image;
  const inked = useInked();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc !== null && failedSrc === src;
  const initials = artist.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${inked ? 'inked' : ''} ${className}`}
      style={{ width: size, height: size, background: seedColor(artist.id) }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={artist.name}
          className="h-full w-full object-cover"
          loading={size >= 200 ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-bold text-white/90" style={{ fontSize: size * 0.36 }}>
          {initials}
        </span>
      )}
      {inked && size >= 40 && <InkSmear seed={artist.id} />}
    </div>
  );
}

/** Quadratisches Album-Cover – immer vollständig, nie beschnitten */
export function Cover({
  src,
  alt,
  className = '',
  rounded = 'rounded-md',
  eager = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  rounded?: string;
  eager?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc !== null && failedSrc === src;
  const inked = useInked();
  return (
    <div className={`relative aspect-square overflow-hidden bg-sp-highlight ${inked ? 'inked' : ''} ${rounded} ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-contain"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sp-muted">
          <MusicNoteIcon size={36} />
        </div>
      )}
      {inked && <InkSmear seed={src ?? alt} />}
    </div>
  );
}

export function PlayerAvatar({ name, color, size = 32, dim = false }: { name: string; color: string; size?: number; dim?: boolean }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full font-extrabold text-black ${dim ? 'opacity-40' : ''}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.45 }}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </div>
  );
}
