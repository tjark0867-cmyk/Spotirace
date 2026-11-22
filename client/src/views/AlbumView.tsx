import { Fragment, useEffect, useState } from 'react';
import type { AlbumDetail, ArtistSummary, TrackInfo } from '../../../shared/types';
import { ArrowRightIcon, ClockIcon, ExternalIcon, LockIcon } from '../components/Icons';
import { Cover } from '../components/Media';
import { api } from '../lib/api';
import { useDominantColor } from '../lib/color';
import { formatAlbumLength, formatTrackDuration, plural, releaseTypeLabel } from '../lib/format';
import { useGame } from '../lib/useGame';

function useAlbum(albumId: string) {
  const [data, setData] = useState<AlbumDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .album(albumId)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [albumId, nonce]);
  return { data, error, reload: () => setNonce((n) => n + 1) };
}

function TrackRow({
  track,
  album,
  current,
  canMove,
}: {
  track: TrackInfo;
  album: AlbumDetail;
  current: ArtistSummary;
  canMove: boolean;
}) {
  const { move, pendingMove } = useGame();
  const playable = track.artists.some((a) => a.id === current.id);
  const jumpable = playable && track.artists.some((a) => a.id !== current.id);

  return (
    <div
      className={`group grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-4 rounded-md px-3 py-2 sm:px-4 ${
        playable ? 'hover:bg-white/[0.08]' : 'opacity-40'
      }`}
      title={playable ? undefined : `${current.name} ist auf diesem Song nicht dabei`}
    >
      <div className="text-right text-base tabular-nums text-sp-sub">
        {playable ? track.number : <LockIcon size={14} className="ml-auto" />}
      </div>
      <div className="min-w-0">
        <div className={`truncate text-base ${playable ? 'text-white' : 'text-sp-sub'}`}>{track.name}</div>
        <div className="min-w-0 text-sm leading-6 text-sp-sub">
          {track.explicit && (
            <span className="mr-1.5 inline-grid h-4 min-w-4 place-items-center rounded-[2px] bg-sp-sub px-1 align-[-2px] text-[10px] font-bold text-black">E</span>
          )}
          {track.artists.map((a, i) => {
            const isCurrent = a.id === current.id;
            const clickable = playable && !isCurrent && canMove;
            const sep = i < track.artists.length - 1 ? ', ' : '';
            return (
              <Fragment key={`${a.id}-${i}`}>
                {clickable ? (
                  <button
                    type="button"
                    disabled={!!pendingMove}
                    onClick={() => move(album.id, track.id, a.id)}
                    className={`inline-flex items-center gap-1 rounded font-semibold text-white underline decoration-white/30 decoration-1 underline-offset-[3px] transition hover:text-sp-green-bright hover:decoration-sp-green-bright disabled:cursor-wait ${
                      pendingMove === a.id ? 'animate-pulse text-sp-green-bright' : ''
                    }`}
                    title={`Zu ${a.name} springen`}
                  >
                    {a.name}
                    <ArrowRightIcon size={12} className="opacity-60 group-hover:opacity-100" />
                  </button>
                ) : (
                  <span className={isCurrent && playable ? 'font-semibold text-sp-green-bright' : ''}>{a.name}</span>
                )}
                {sep}
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {jumpable && (
          <span className="hidden rounded-full bg-sp-green/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sp-green-bright sm:inline">
            Feature
          </span>
        )}
        <span className="w-10 text-right text-sm tabular-nums text-sp-sub">{formatTrackDuration(track.durationMs)}</span>
      </div>
    </div>
  );
}

export function AlbumView({
  albumId,
  current,
  canMove,
  demo,
  onLoaded,
}: {
  albumId: string;
  current: ArtistSummary;
  canMove: boolean;
  demo: boolean;
  onLoaded?: (album: AlbumDetail) => void;
}) {
  const { data, error, reload } = useAlbum(albumId);
  const color = useDominantColor(data?.cover, albumId);

  useEffect(() => {
    if (data) onLoaded?.(data);
  }, [data, onLoaded]);

  if (error) {
    return (
      <div className="px-8 py-24 text-center">
        <div className="text-2xl font-bold">Album konnte nicht geladen werden</div>
        <p className="mx-auto mt-2 max-w-md text-sp-sub">{error}</p>
        <button type="button" className="btn-outline mt-6" onClick={reload}>
          Nochmal versuchen
        </button>
      </div>
    );
  }

  const isOwn = !!data?.artists.some((a) => a.id === current.id);
  const playableCount = data ? data.tracks.filter((t) => t.artists.some((a) => a.id === current.id)).length : 0;
  const totalMs = data ? data.tracks.reduce((s, t) => s + t.durationMs, 0) : 0;
  const discs = data ? Array.from(new Set(data.tracks.map((t) => t.disc))) : [];

  return (
    <div>
      <header className="relative" style={{ background: color }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
        <div className="relative flex flex-col items-center gap-5 px-5 pb-6 pt-[72px] text-center sm:flex-row sm:items-end sm:gap-7 sm:px-8 sm:pt-20 sm:text-left">
          {data ? (
            <Cover src={data.cover} alt={data.name} className="w-[200px] shrink-0 shadow-[0_8px_40px_rgba(0,0,0,.55)] sm:w-[232px]" rounded="rounded" />
          ) : (
            <div className="skeleton aspect-square w-[200px] shrink-0 rounded sm:w-[232px]" />
          )}
          <div className="min-w-0 pb-1">
            <div className="text-sm font-semibold">{data ? releaseTypeLabel(data.type, data.totalTracks) : 'Album'}</div>
            {data ? (
              <h1
                className="mt-1 break-words font-black leading-[1.05] tracking-tight"
                style={{ fontSize: data.name.length > 28 ? 'clamp(1.8rem, 3.6vw, 3rem)' : 'clamp(2.2rem, 5.5vw, 4.5rem)' }}
              >
                {data.name}
              </h1>
            ) : (
              <div className="skeleton mt-3 h-14 w-72 max-w-full rounded" />
            )}
            {data && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-white/80 sm:justify-start">
                <span className="font-bold text-white">{data.artists.map((a) => a.name).join(', ')}</span>
                {data.year && <span>• {data.year}</span>}
                <span>• {plural(data.tracks.length, 'Song', 'Songs')},</span>
                <span className="text-white/60">{formatAlbumLength(totalMs)}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="px-2 pb-10 sm:px-5" style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 38%, transparent) 0, transparent 240px)` }}>
        {data && (
          <div className="px-2 pb-2 pt-6 sm:px-3">
            {isOwn ? (
              <p className="text-sm text-sp-sub">
                Klicke auf einen <span className="font-semibold text-white underline decoration-white/30 underline-offset-[3px]">anderen Artist</span> in
                einem Song, um zu ihm zu springen.
              </p>
            ) : (
              <div className="flex items-start gap-3 rounded-lg bg-white/[0.06] p-4">
                <LockIcon size={18} className="mt-0.5 shrink-0 text-sp-sub" />
                <p className="text-sm text-sp-sub">
                  <b className="text-white">Erscheint auf:</b> Nur {playableCount === 1 ? 'der Song' : `die ${playableCount} Songs`} mit{' '}
                  <span className="font-semibold text-sp-green-bright">{current.name}</span> {playableCount === 1 ? 'ist' : 'sind'} auswählbar.
                  Der Rest ist gesperrt.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 grid grid-cols-[24px_minmax(0,1fr)_auto] gap-4 border-b border-white/10 px-5 pb-2 text-sm text-sp-sub sm:px-7">
          <span className="text-right">#</span>
          <span>Titel</span>
          <ClockIcon size={16} className="mr-1" />
        </div>

        <div className="mt-2">
          {!data &&
            Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="skeleton h-4 w-4 rounded" />
                <div className="flex-1">
                  <div className="skeleton h-4 w-1/3 rounded" />
                  <div className="skeleton mt-2 h-3 w-1/5 rounded" />
                </div>
              </div>
            ))}
          {data &&
            discs.map((disc) => (
              <Fragment key={disc}>
                {discs.length > 1 && <div className="px-4 pb-1 pt-4 text-sm font-bold text-sp-sub">CD {disc}</div>}
                {data.tracks
                  .filter((t) => t.disc === disc)
                  .map((t) => (
                    <TrackRow key={t.id} track={t} album={data} current={current} canMove={canMove} />
                  ))}
              </Fragment>
            ))}
        </div>

        {data && (
          <footer className="mt-10 border-t border-white/10 px-2 pt-6 text-xs text-sp-muted sm:px-3">
            {demo ? (
              'Demo-Daten · erfundene Artists'
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                Musikdaten von Spotify
                {data.url && (
                  <a href={data.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white hover:underline">
                    Album auf Spotify öffnen <ExternalIcon size={12} />
                  </a>
                )}
              </span>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
