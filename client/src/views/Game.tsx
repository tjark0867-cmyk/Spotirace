import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { AlbumDetail, ArtistSummary, PlayerPublic, ReleaseGroup, ReleaseSummary, RoomState } from '../../../shared/types';
import { AppShell } from '../components/AppShell';
import { Confetti } from '../components/Confetti';
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, FlagIcon, UndoIcon } from '../components/Icons';
import { ArtistImage, Cover } from '../components/Media';
import { PathChain } from '../components/PathChain';
import { formatClock } from '../lib/format';
import { sound } from '../lib/sound';
import { useGame, useServerNow } from '../lib/useGame';
import { AlbumView } from './AlbumView';
import { ArtistView } from './ArtistView';

type View = { kind: 'artist' } | { kind: 'album'; albumId: string; name: string; cover: string | null; group: ReleaseGroup };

// ---------- Countdown ----------

function CountdownOverlay({ state }: { state: RoomState }) {
  const now = useServerNow(100);
  const remaining = (state.startAt ?? 0) - now;
  const [show, setShow] = useState(() => remaining > -900);

  useEffect(() => {
    if (state.phase === 'playing' && remaining < -900) setShow(false);
  }, [state.phase, remaining]);

  const n = Math.ceil(remaining / 1000);
  const label = n > 0 ? String(Math.min(n, 3)) : 'Los!';

  // 3 – 2 – 1 – Los! hörbar machen
  useEffect(() => {
    if (!show) return;
    sound.play(label === 'Los!' ? 'go' : 'countTick');
  }, [label, show]);

  if (!show || !state.start || !state.target) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 backdrop-blur-md">
      <div className="flex flex-col items-center gap-10 px-6 text-center">
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="flex flex-col items-center gap-2">
            <ArtistImage artist={state.start} size={96} className="ring-2 ring-sp-green" />
            <div className="max-w-[140px] truncate font-bold">{state.start.name}</div>
            <div className="text-xs font-bold uppercase tracking-widest text-sp-green-bright">Start</div>
          </div>
          <ChevronRightIcon size={36} className="text-sp-muted" />
          <div className="flex flex-col items-center gap-2">
            <ArtistImage artist={state.target} size={96} className="ring-2 ring-[#f573a0]" />
            <div className="max-w-[140px] truncate font-bold">{state.target.name}</div>
            <div className="text-xs font-bold uppercase tracking-widest text-[#f573a0]">Ziel</div>
          </div>
        </div>
        <div key={label} className={`animate-pop font-black tabular-nums ${n > 0 ? 'text-[9rem] leading-none' : 'text-8xl text-sp-green-bright'}`}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ---------- Breadcrumb ----------

function TopBar({
  state,
  view,
  onBack,
  scrollEl,
}: {
  state: RoomState;
  view: View;
  onBack: () => void;
  scrollEl: RefObject<HTMLElement | null>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [solid, setSolid] = useState(false);
  const path = state.yourPath;

  // Wie bei Spotify: über dem Header durchsichtig, beim Scrollen deckend
  useEffect(() => {
    const el = scrollEl.current;
    if (!el) return;
    const onScroll = () => setSolid(el.scrollTop > 200);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollEl, view]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, [path.length, view]);

  return (
    <div
      className={`sticky top-0 z-20 flex items-center gap-3 px-3 py-3 transition-colors duration-300 sm:px-5 ${
        solid ? 'bg-sp-base/95 shadow-[0_4px_12px_rgba(0,0,0,.35)] backdrop-blur-md' : 'bg-black/10'
      }`}
    >
      <button
        type="button"
        onClick={onBack}
        disabled={view.kind === 'artist'}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/70 text-white transition enabled:hover:scale-105 disabled:opacity-30"
        title="Zurück zur Artist-Seite"
      >
        <ChevronLeftIcon size={18} />
      </button>
      <div ref={scrollRef} className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {path.map((step, i) => {
          const last = i === path.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && (step.back ? <UndoIcon size={14} className="shrink-0 text-sp-muted" /> : <ChevronRightIcon size={14} className="shrink-0 text-sp-muted" />)}
              <div
                className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-semibold ${
                  last && view.kind === 'artist' ? 'bg-white text-black' : last ? 'bg-white/10 text-white' : 'text-sp-sub'
                }`}
                title={step.via ? `über „${step.via.trackName}“` : undefined}
              >
                <ArtistImage artist={step.artist} size={24} />
                <span className="max-w-[160px] truncate">{step.artist.name}</span>
              </div>
            </Fragment>
          );
        })}
        {view.kind === 'album' && (
          <>
            <ChevronRightIcon size={14} className="shrink-0 text-sp-muted" />
            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-sm font-semibold text-black">
              <Cover src={view.cover} alt={view.name} className="w-6" rounded="rounded-full" />
              <span className="max-w-[180px] truncate">{view.name}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Player-Bar unten ----------

function PlayerBar({ state, me }: { state: RoomState; me: PlayerPublic | null }) {
  const { send } = useGame();
  const now = useServerNow(250);
  const startAt = state.startAt ?? now;
  const playing = me?.status === 'playing' && state.phase === 'playing';
  const elapsed = me?.finishMs ?? (state.phase === 'countdown' ? 0 : Math.max(0, (state.endedAt ?? now) - startAt));
  const limitMs = state.endsAt ? state.endsAt - startAt : null;
  const remaining = state.endsAt ? Math.max(0, state.endsAt - now) : null;
  const progress = limitMs ? Math.min(1, Math.max(0, (now - startAt) / limitMs)) : null;
  let depth = 0;
  for (const step of state.yourPath) depth += step.back ? -1 : 1;
  const canBack = playing && state.settings.allowBack && depth > 1;
  const stillPlaying = state.players.filter((p) => p.status === 'playing').length;

  // Die letzten 10 Sekunden ticken
  const secondsLeft = remaining !== null && state.phase === 'playing' ? Math.ceil(remaining / 1000) : null;
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 10 && playing) sound.play('tick');
  }, [secondsLeft, playing]);

  return (
    <footer className="grid h-[76px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2 sm:gap-4">
      {/* Ziel */}
      <div className="flex min-w-0 items-center gap-3">
        {state.target && (
          <ArtistImage artist={state.target} size={52} className="!h-10 !w-10 ring-2 ring-[#f573a0]/70 sm:!h-[52px] sm:!w-[52px]" />
        )}
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#f573a0]">Ziel</div>
          <div className="truncate text-sm font-bold text-white sm:text-base">{state.target?.name}</div>
        </div>
      </div>

      {/* Zeit */}
      <div className="flex flex-col items-center gap-1.5 sm:w-[min(40vw,420px)]">
        <div className="flex items-center gap-2">
          <ClockIcon size={16} className="text-sp-sub" />
          <span className="text-xl font-extrabold tabular-nums">{formatClock(elapsed)}</span>
          {remaining !== null && state.phase !== 'results' && (
            <span className={`hidden text-sm tabular-nums sm:inline ${remaining < 60_000 ? 'font-bold text-sp-red' : 'text-sp-sub'}`}>
              noch {formatClock(remaining)}
            </span>
          )}
        </div>
        {progress !== null ? (
          <div className="h-1 w-24 overflow-hidden sm:w-full rounded-full bg-white/20">
            <div className={`h-full rounded-full ${remaining !== null && remaining < 60_000 ? 'bg-sp-red' : 'bg-white'}`} style={{ width: `${progress * 100}%` }} />
          </div>
        ) : (
          <div className="hidden text-[11px] text-sp-muted sm:block">{stillPlaying > 0 ? `${stillPlaying} noch unterwegs` : 'Runde vorbei'}</div>
        )}
      </div>

      {/* Klicks + Aktionen */}
      <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
        <div className="text-right">
          <div className="text-xl font-extrabold tabular-nums leading-none">{me?.clicks ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wider text-sp-muted">Klicks</div>
        </div>
        {state.settings.allowBack && (
          <button
            type="button"
            disabled={!canBack}
            onClick={() => send({ t: 'back' })}
            className="grid h-10 w-10 place-items-center rounded-full text-sp-sub transition enabled:hover:scale-105 enabled:hover:text-white disabled:opacity-30"
            title="Zurück zum vorherigen Artist (zählt als Klick)"
          >
            <UndoIcon size={20} />
          </button>
        )}
        <button
          type="button"
          disabled={!playing}
          onClick={() => window.confirm('Wirklich aufgeben?') && send({ t: 'giveUp' })}
          className="hidden rounded-full border border-sp-muted px-4 py-1.5 text-sm font-bold transition enabled:hover:border-white disabled:opacity-30 sm:block"
        >
          Aufgeben
        </button>
        <button
          type="button"
          disabled={!playing}
          onClick={() => window.confirm('Wirklich aufgeben?') && send({ t: 'giveUp' })}
          className="grid h-10 w-10 place-items-center rounded-full text-sp-sub disabled:opacity-30 sm:hidden"
          title="Aufgeben"
        >
          <FlagIcon size={18} />
        </button>
      </div>
    </footer>
  );
}

// ---------- Fertig / Zuschauer ----------

function DonePanel({ state, me }: { state: RoomState; me: PlayerPublic }) {
  const stillPlaying = state.players.filter((p) => p.status === 'playing');
  const finished = me.status === 'finished';
  const title =
    me.status === 'finished' ? 'Geschafft!' : me.status === 'gaveup' ? 'Aufgegeben' : me.status === 'timeout' ? 'Zeit abgelaufen' : 'Du schaust zu';
  return (
    <div className="min-h-full bg-gradient-to-b from-[#1d6b3a] via-[#11331f] to-sp-base px-5 pb-12 pt-12 sm:px-8">
      {finished && <Confetti />}
      <div className="animate-fade-up">
        <div className="text-sm font-bold uppercase tracking-widest text-sp-green-bright">{finished ? `Platz ${me.place}` : 'Runde läuft'}</div>
        <h1 className="mt-2 text-5xl font-black tracking-tight sm:text-7xl">{title}</h1>
        {finished && (
          <p className="mt-4 text-lg text-white/85">
            Du bist in <b>{formatClock(me.finishMs ?? 0)}</b> mit <b>{me.clicks}</b> {me.clicks === 1 ? 'Klick' : 'Klicks'} bei{' '}
            <b>{state.target?.name}</b> angekommen.
          </p>
        )}
        {me.status === 'idle' && <p className="mt-4 text-lg text-white/85">Du bist während einer laufenden Runde beigetreten und spielst in der nächsten mit.</p>}
      </div>

      {state.yourPath.length > 0 && (
        <div className="mt-10 rounded-lg bg-black/25 p-5">
          <div className="mb-4 text-sm font-bold uppercase tracking-widest text-sp-sub">Dein Weg</div>
          <PathChain path={state.yourPath} targetId={state.target?.id} />
        </div>
      )}

      <div className="mt-8 text-sp-sub">
        {stillPlaying.length > 0
          ? `Warte auf ${stillPlaying.length === 1 ? stillPlaying[0].name : `${stillPlaying.length} Spieler`} …`
          : 'Alle sind fertig – gleich kommt das Ergebnis.'}
      </div>
    </div>
  );
}

// ---------- Spiel ----------

export function Game({ state, demo }: { state: RoomState; demo: boolean }) {
  const { me } = useGame();
  const mainRef = useRef<HTMLElement | null>(null);
  const artistScroll = useRef(0);
  const [view, setView] = useState<View>({ kind: 'artist' });
  const restoreScroll = useRef<number | null>(null);

  const current: ArtistSummary | null = state.yourPath[state.yourPath.length - 1]?.artist ?? null;
  const active = me?.status === 'playing';

  // Neuer Artist → Artist-Seite von oben zeigen
  useEffect(() => {
    setView({ kind: 'artist' });
    artistScroll.current = 0;
    mainRef.current?.scrollTo({ top: 0 });
  }, [current?.id, state.yourPath.length]);

  // Scroll-Position der Artist-Seite wiederherstellen, wenn man vom Album zurückkommt
  useLayoutEffect(() => {
    if (view.kind === 'artist' && restoreScroll.current !== null) {
      mainRef.current?.scrollTo({ top: restoreScroll.current });
      restoreScroll.current = null;
    }
  }, [view]);

  const openAlbum = useCallback((release: ReleaseSummary, group: ReleaseGroup) => {
    sound.play('open');
    artistScroll.current = mainRef.current?.scrollTop ?? 0;
    setView({ kind: 'album', albumId: release.id, name: release.name, cover: release.coverSmall ?? release.cover, group });
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  const backToArtist = useCallback(() => {
    sound.play('close');
    restoreScroll.current = artistScroll.current;
    setView({ kind: 'artist' });
  }, []);

  const onAlbumLoaded = useCallback((album: AlbumDetail) => {
    setView((v) => (v.kind === 'album' && v.albumId === album.id && !v.cover ? { ...v, cover: album.coverSmall ?? album.cover } : v));
  }, []);

  // Browser-Zurück (z. B. Wischgeste am Handy) schließt das Album, statt das Spiel zu verlassen
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    history.pushState({ spotirace: true }, '');
    const onPop = () => {
      if (viewRef.current.kind === 'album') backToArtist();
      history.pushState({ spotirace: true }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [backToArtist]);

  const showDone = !!me && (me.status !== 'playing' || !current) && state.phase !== 'countdown';

  return (
    <AppShell state={state} mainRef={mainRef} bottomBar={<PlayerBar state={state} me={me} />}>
      {(state.phase === 'countdown' || state.phase === 'playing') && <CountdownOverlay state={state} />}

      {showDone && me ? (
        <DonePanel state={state} me={me} />
      ) : current ? (
        <>
          <TopBar state={state} view={view} onBack={backToArtist} scrollEl={mainRef} />
          <div className={view.kind === 'artist' ? '-mt-[56px]' : 'hidden'}>
            <ArtistView
              key={current.id}
              artistId={current.id}
              isFirst={state.yourPath.length === 1}
              onOpenAlbum={openAlbum}
              demo={demo}
            />
          </div>
          {view.kind === 'album' && (
            <div className="-mt-[56px]">
              <AlbumView key={view.albumId} albumId={view.albumId} current={current} canMove={active} demo={demo} onLoaded={onAlbumLoaded} />
            </div>
          )}
        </>
      ) : null}
    </AppShell>
  );
}
