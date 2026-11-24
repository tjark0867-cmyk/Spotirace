import type { PlayerPublic, RoomState } from '../../../shared/types';
import { AppShell } from '../components/AppShell';
import { Confetti } from '../components/Confetti';
import { ChevronRightIcon, CrownIcon, ExitIcon, PlayIcon } from '../components/Icons';
import { ArtistImage, PlayerAvatar } from '../components/Media';
import { Medal, MetalNumeral } from '../components/Medal';
import { PathChain } from '../components/PathChain';
import { formatClock } from '../lib/format';
import { useGame } from '../lib/useGame';

function ranked(players: PlayerPublic[]): PlayerPublic[] {
  const order = (p: PlayerPublic) => (p.status === 'finished' ? 0 : p.status === 'timeout' ? 1 : p.status === 'gaveup' ? 2 : 3);
  return [...players]
    .filter((p) => p.status !== 'idle')
    .sort((a, b) => order(a) - order(b) || (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity) || a.clicks - b.clicks);
}

const PODIUM_STYLE: Record<number, { height: string; block: string; top: string; delay: string }> = {
  1: { height: 'h-[150px] sm:h-[180px]', block: 'from-[#6b4d0f] via-[#3a2a08] to-[#1a1407]', top: 'border-[#ffd965]', delay: '0.45s' },
  2: { height: 'h-[115px] sm:h-[140px]', block: 'from-[#4a525b] via-[#2a2f35] to-[#16191c]', top: 'border-[#e4e9ee]', delay: '0.25s' },
  3: { height: 'h-[90px] sm:h-[108px]', block: 'from-[#5a3317] via-[#33200f] to-[#1a0f07]', top: 'border-[#f3b27a]', delay: '0.05s' },
};

function Podium({ top, meId }: { top: PlayerPublic[]; meId: string | undefined }) {
  // Reihenfolge wie bei einer Siegerehrung: 2 – 1 – 3
  const order = [top[1], top[0], top[2]].map((p, i) => (p ? { p, place: [2, 1, 3][i] } : null));
  return (
    <div className="mx-auto flex max-w-xl items-end justify-center gap-2 px-4 pt-6 sm:gap-4">
      {order.map((entry, i) => {
        if (!entry) return <div key={i} className="flex-1" />;
        const { p, place } = entry;
        const st = PODIUM_STYLE[place];
        return (
          <div key={p.id} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="mb-3 flex min-w-0 flex-col items-center animate-fade-up" style={{ animationDelay: st.delay }}>
              {place === 1 && <CrownIcon size={26} className="mb-1 text-[#ffd965] drop-shadow-[0_2px_8px_rgba(255,200,60,.6)]" />}
              <div className={place === 1 ? 'rounded-full ring-4 ring-[#ffd965]/70' : ''}>
                <PlayerAvatar name={p.name} color={p.color} size={place === 1 ? 64 : 52} />
              </div>
              <div className={`mt-2 max-w-full truncate text-center font-extrabold ${p.id === meId ? 'text-sp-green-bright' : 'text-white'} ${place === 1 ? 'text-lg' : 'text-sm sm:text-base'}`}>
                {p.name}
              </div>
              <div className="text-xs tabular-nums text-sp-sub">
                {formatClock(p.finishMs ?? 0)} · {p.clicks} {p.clicks === 1 ? 'Klick' : 'Klicks'}
              </div>
            </div>
            <div
              className={`relative w-full origin-bottom animate-rise overflow-hidden rounded-t-xl border-t-4 bg-gradient-to-b ${st.block} ${st.top} ${st.height}`}
              style={{ animationDelay: st.delay }}
            >
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
              <div className="relative flex justify-center pt-2">
                <MetalNumeral place={place} size={place === 1 ? 96 : place === 2 ? 76 : 64} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Results({ state }: { state: RoomState }) {
  const { send, me } = useGame();
  const list = ranked(state.players);
  const finishers = list.filter((p) => p.status === 'finished');
  const winner = finishers[0];
  const iWon = !!winner && winner.id === me?.id;

  return (
    <AppShell state={state}>
      {iWon && <Confetti pieces={110} />}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#3b2a0a] via-[#1b1408] to-sp-base px-5 pb-4 pt-10 sm:px-8">
        {/* goldenes Leuchten hinter dem Podest */}
        <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,205,70,.28),transparent_65%)]" />
        <div className="relative">
          <div className="text-sm font-bold text-white/80">Ergebnis · Runde {state.round}</div>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">
            {winner ? `${winner.name} gewinnt!` : 'Niemand ist angekommen'}
          </h1>
          {state.start && state.target && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-white/85">
              <span className="flex items-center gap-2">
                <ArtistImage artist={state.start} size={28} /> {state.start.name}
              </span>
              <ChevronRightIcon size={16} className="text-white/50" />
              <span className="flex items-center gap-2">
                <ArtistImage artist={state.target} size={28} /> {state.target.name}
              </span>
            </div>
          )}
          {finishers.length > 0 && <Podium top={finishers.slice(0, 3)} meId={me?.id} />}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 px-5 py-6 sm:px-8">
        {me?.isHost ? (
          <button type="button" className="btn-green" onClick={() => send({ t: 'again' })}>
            <PlayIcon size={18} /> Nochmal spielen
          </button>
        ) : (
          <div className="rounded-full bg-white/[0.06] px-5 py-3 text-sm text-white/80">Der Host kann eine neue Runde starten</div>
        )}
        <button type="button" className="btn-outline" onClick={() => send({ t: 'leave' })}>
          <ExitIcon size={16} /> Lobby verlassen
        </button>
      </div>

      <div className="space-y-3 px-3 pb-12 sm:px-6">
        <h2 className="px-1 text-xl font-bold">Alle Wege</h2>
        {list.map((p, i) => {
          const finished = p.status === 'finished';
          const place = finished ? i + 1 : null;
          return (
            <div
              key={p.id}
              className={`animate-fade-up rounded-lg p-4 sm:p-5 ${p.id === me?.id ? 'bg-white/[0.08]' : 'bg-sp-card'} ${place === 1 ? 'ring-1 ring-[#ffd965]/40' : ''}`}
              style={{ animationDelay: `${0.6 + i * 0.08}s` }}
            >
              <div className="mb-4 flex items-center gap-3 sm:gap-4">
                {place ? <Medal place={place} size={46} /> : <div className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-sp-muted">–</div>}
                <PlayerAvatar name={p.name} color={p.color} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-lg font-bold">
                    {p.name}
                    {p.isHost && <CrownIcon size={14} className="text-[#ffc864]" />}
                  </div>
                  <div className="text-sm text-sp-sub">
                    {finished ? 'im Ziel' : p.status === 'gaveup' ? 'aufgegeben' : p.status === 'timeout' ? 'Zeit abgelaufen' : ''}
                  </div>
                </div>
                <div className="flex gap-4 text-right sm:gap-5">
                  <div>
                    <div className="text-lg font-extrabold tabular-nums">{finished ? formatClock(p.finishMs ?? 0) : '—'}</div>
                    <div className="text-[10px] uppercase tracking-wider text-sp-muted">Zeit</div>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold tabular-nums">{p.clicks}</div>
                    <div className="text-[10px] uppercase tracking-wider text-sp-muted">Klicks</div>
                  </div>
                </div>
              </div>
              <PathChain path={p.path ?? []} targetId={state.target?.id} />
            </div>
          );
        })}
        {list.length === 0 && <div className="py-10 text-center text-sp-sub">Keine Teilnehmer in dieser Runde.</div>}
      </div>
    </AppShell>
  );
}
