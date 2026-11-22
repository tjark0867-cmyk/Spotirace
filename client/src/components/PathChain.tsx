import { Fragment } from 'react';
import type { PathStep } from '../../../shared/types';
import { ChevronRightIcon, UndoIcon } from './Icons';
import { ArtistImage, Cover } from './Media';

/** Der Weg eines Spielers: Artist → Song (Cover) → Artist → … */
export function PathChain({ path, targetId }: { path: PathStep[]; targetId?: string | null }) {
  if (path.length === 0) return <div className="text-sm text-sp-muted">Kein Weg</div>;
  return (
    <div className="sp-scroll -mx-1 overflow-x-auto px-1 pb-3 pt-1">
      <div className="flex w-max items-center gap-2">
        {path.map((step, i) => {
          const isTarget = step.artist.id === targetId;
          return (
            <Fragment key={i}>
              {i > 0 && (
                <div className="flex items-center gap-2">
                  <ChevronRightIcon size={16} className="text-sp-muted" />
                  {step.via ? (
                    <div className="flex w-[156px] items-center gap-2 rounded-md bg-white/[0.05] p-1.5 pr-2" title={`${step.via.trackName} – ${step.via.albumName}`}>
                      <Cover src={step.via.cover} alt={step.via.albumName} className="w-10 shrink-0" rounded="rounded" />
                      <div className="min-w-0">
                        <div className="line-clamp-2 break-words text-xs font-semibold leading-tight text-white">{step.via.trackName}</div>
                      </div>
                    </div>
                  ) : step.back ? (
                    <div className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-sp-sub">
                      <UndoIcon size={13} /> zurück
                    </div>
                  ) : null}
                  <ChevronRightIcon size={16} className="text-sp-muted" />
                </div>
              )}
              <div className="flex w-[76px] flex-col items-center gap-1.5 text-center">
                <ArtistImage
                  artist={step.artist}
                  size={56}
                  className={isTarget ? 'ring-2 ring-sp-green ring-offset-2 ring-offset-sp-card' : i === 0 ? 'ring-2 ring-white/30' : ''}
                />
                <div className={`line-clamp-2 text-xs font-semibold leading-tight ${isTarget ? 'text-sp-green-bright' : 'text-white'}`}>
                  {step.artist.name}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
