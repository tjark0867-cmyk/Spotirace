import { useEffect, useMemo, useState } from 'react';
import { RELEASE_GROUPS, type ArtistPage, type ReleaseGroup, type ReleaseSummary } from '../../../shared/types';
import { ExternalIcon, PlayIcon } from '../components/Icons';
import { ArtistImage, Cover } from '../components/Media';
import { api } from '../lib/api';
import { useDominantColor } from '../lib/color';
import { GROUP_LABELS, dedupeReleases, plural, releaseTypeLabel } from '../lib/format';
import { useGame } from '../lib/useGame';

type Filter = 'all' | ReleaseGroup;

function nameSize(name: string): string {
  if (name.length <= 12) return 'clamp(3rem, 7.5vw, 6rem)';
  if (name.length <= 22) return 'clamp(2.4rem, 5.5vw, 4.5rem)';
  return 'clamp(2rem, 4vw, 3.4rem)';
}

function useArtistData(artistId: string) {
  const { toast } = useGame();
  const [data, setData] = useState<ArtistPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState<ReleaseGroup | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .artistPage(artistId)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [artistId, nonce]);

  const loadMore = async (group: ReleaseGroup) => {
    const section = data?.sections[group];
    if (!section || section.next === null) return;
    setLoadingMore(group);
    try {
      const page = await api.releases(artistId, group, section.next);
      setData((d) => {
        if (!d || d.artist.id !== artistId) return d;
        const prev = d.sections[group];
        const seen = new Set(prev.items.map((i) => i.id));
        return {
          ...d,
          sections: {
            ...d.sections,
            [group]: { ...prev, items: [...prev.items, ...page.items.filter((i) => !seen.has(i.id))], total: page.total, next: page.next },
          },
        };
      });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setLoadingMore(null);
    }
  };

  const reload = () => {
    api.forget(`/api/artist/${artistId}`);
    setNonce((n) => n + 1);
  };

  return { data, error, loadingMore, loadMore, reload };
}

function ReleaseCard({ release, group, onOpen }: { release: ReleaseSummary; group: ReleaseGroup; onOpen: () => void }) {
  const sub = group === 'appears_on' ? release.artists.map((a) => a.name).join(', ') : releaseTypeLabel(release.type, release.totalTracks);
  return (
    <button
      type="button"
      onClick={onOpen}
      // Album schon laden, sobald der Finger/die Maus drauf ist → öffnet sich fast sofort
      onPointerEnter={() => api.album(release.id).catch(() => {})}
      onPointerDown={() => api.album(release.id).catch(() => {})}
      onFocus={() => api.album(release.id).catch(() => {})}
      className="group flex flex-col rounded-md p-2.5 text-left transition hover:bg-sp-hover focus-visible:bg-sp-hover focus-visible:outline-none sm:p-3"
    >
      <div className="relative mb-3">
        <Cover src={release.coverSmall ?? release.cover} alt={release.name} className="shadow-[0_8px_24px_rgba(0,0,0,.5)]" />
        <span className="absolute bottom-2 right-2 grid h-12 w-12 translate-y-2 place-items-center rounded-full bg-sp-green text-black opacity-0 shadow-[0_8px_8px_rgba(0,0,0,.3)] transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-hover:scale-100 hover:scale-105 hover:bg-sp-green-bright">
          <PlayIcon size={22} />
        </span>
      </div>
      <div className="line-clamp-2 font-bold leading-snug text-white">{release.name}</div>
      <div className="mt-1 line-clamp-2 text-sm text-sp-sub">
        {release.year}
        {release.year && ' • '}
        {sub}
      </div>
    </button>
  );
}

function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="p-3">
          <div className="skeleton aspect-square w-full rounded-md" />
          <div className="skeleton mt-3 h-4 w-3/4 rounded" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ArtistView({
  artistId,
  isFirst,
  onOpenAlbum,
  demo,
}: {
  artistId: string;
  isFirst: boolean;
  onOpenAlbum: (release: ReleaseSummary, group: ReleaseGroup) => void;
  demo: boolean;
}) {
  const { data, error, loadingMore, loadMore, reload } = useArtistData(artistId);
  const [filter, setFilter] = useState<Filter>('all');
  const [hideDupes, setHideDupes] = useState(true);
  const color = useDominantColor(data?.artist.image, artistId);

  const sections = useMemo(() => {
    if (!data) return [];
    return RELEASE_GROUPS.map((group) => {
      const section = data.sections[group];
      const items = hideDupes ? dedupeReleases(section.items) : section.items;
      return { group, section, items };
    });
  }, [data, hideDupes]);

  if (error) {
    return (
      <div className="px-8 py-24 text-center">
        <div className="text-2xl font-bold">Artist konnte nicht geladen werden</div>
        <p className="mx-auto mt-2 max-w-md text-sp-sub">{error}</p>
        <button type="button" className="btn-outline mt-6" onClick={reload}>
          Nochmal versuchen
        </button>
      </div>
    );
  }

  const artist = data?.artist;
  const visible = sections.filter((s) => (filter === 'all' ? s.section.items.length > 0 || s.section.error : s.group === filter));
  const totalReleases = sections.reduce((n, s) => n + s.section.total, 0);

  return (
    <div>
      <header className="relative" style={{ background: color }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
        <div className="relative flex flex-col items-center gap-5 px-5 pb-6 pt-[72px] text-center sm:flex-row sm:items-end sm:gap-7 sm:px-8 sm:pt-20 sm:text-left">
          {artist ? (
            <ArtistImage
              artist={artist}
              size={232}
              className="!h-[168px] !w-[168px] shadow-[0_8px_40px_rgba(0,0,0,.55)] sm:!h-[232px] sm:!w-[232px]"
            />
          ) : (
            <div className="skeleton h-[168px] w-[168px] rounded-full sm:h-[232px] sm:w-[232px]" />
          )}
          <div className="min-w-0 pb-1">
            <div className="text-sm font-semibold">Künstler:in</div>
            {artist ? (
              <h1 className="mt-1 break-words font-black leading-[1.05] tracking-tight" style={{ fontSize: nameSize(artist.name) }}>
                {artist.name}
              </h1>
            ) : (
              <div className="skeleton mt-3 h-16 w-72 max-w-full rounded" />
            )}
            {artist && artist.genres.length > 0 && <div className="mt-3 text-sm text-white/80">{artist.genres.slice(0, 4).join(' · ')}</div>}
            {data && <div className="mt-1 text-sm text-white/70">{plural(totalReleases, 'Release', 'Releases')} in der Diskografie</div>}
          </div>
        </div>
      </header>

      <div className="px-3 pb-10 sm:px-5" style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 38%, transparent) 0, transparent 240px)` }}>
        {isFirst && (
          <div className="mx-2 mb-2 pt-5 text-sm text-sp-sub sm:mx-3">
            💡 Öffne ein Album und klicke auf einen anderen Artist in einem Song, um zu ihm zu springen.
          </div>
        )}

        <h2 className="px-2 pb-3 pt-5 text-2xl font-bold sm:px-3">Diskografie</h2>
        <div className="no-scrollbar -mt-1 flex items-center gap-2 overflow-x-auto px-2 pb-4 sm:px-3">
          {(['all', ...RELEASE_GROUPS] as Filter[]).map((f) => {
            const count = f === 'all' ? null : data?.sections[f].total;
            return (
              <button key={f} type="button" className={`chip ${filter === f ? 'chip-active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Alle' : GROUP_LABELS[f]}
                {count != null && count > 0 && <span className="ml-1.5 opacity-60">{count}</span>}
              </button>
            );
          })}
          <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 pl-3 text-sm text-sp-sub">
            <input type="checkbox" className="h-4 w-4 accent-[#1db954]" checked={hideDupes} onChange={(e) => setHideDupes(e.target.checked)} />
            Duplikate ausblenden
          </label>
        </div>

        {!data && <SkeletonGrid count={8} />}

        {data &&
          visible.map(({ group, section, items }) => (
            <section key={group} className="mb-6">
              <div className="mb-1 flex items-baseline justify-between px-2 sm:px-3">
                <h3 className="text-xl font-bold">{GROUP_LABELS[group]}</h3>
                <span className="text-sm text-sp-sub">
                  {section.items.length < section.total ? `${section.items.length} von ${section.total}` : plural(section.total, 'Release', 'Releases')}
                </span>
              </div>
              {group === 'appears_on' && items.length > 0 && (
                <p className="mb-1 px-2 text-sm text-sp-sub sm:px-3">Hier sind nur die Songs auswählbar, auf denen {data.artist.name} mitwirkt.</p>
              )}
              {section.error && <p className="px-2 py-3 text-sm text-sp-red sm:px-3">Konnte nicht geladen werden: {section.error}</p>}
              {!section.error && items.length === 0 && <p className="px-2 py-3 text-sm text-sp-muted sm:px-3">Nichts gefunden.</p>}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-2">
                {items.map((r) => (
                  <ReleaseCard key={r.id} release={r} group={group} onOpen={() => onOpenAlbum(r, group)} />
                ))}
              </div>
              {section.next !== null && (
                <div className="mt-2 px-2 sm:px-3">
                  <button type="button" className="btn-outline" disabled={loadingMore === group} onClick={() => loadMore(group)}>
                    {loadingMore === group ? 'Lädt …' : `Mehr laden (${section.total - section.items.length} weitere)`}
                  </button>
                </div>
              )}
            </section>
          ))}

        {data && (
          <footer className="mt-10 border-t border-white/10 px-2 pt-6 text-xs text-sp-muted sm:px-3">
            {demo ? (
              'Demo-Daten · erfundene Artists'
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                Musikdaten von Spotify
                {data.artist.url && (
                  <a href={data.artist.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white hover:underline">
                    {data.artist.name} auf Spotify öffnen <ExternalIcon size={12} />
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
