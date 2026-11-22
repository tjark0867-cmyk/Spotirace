import type { PlayerPublic, RoomState } from '../../../shared/types';
import { AppShell } from '../components/AppShell';
import { Confetti } from '../components/Confetti';
import { ChevronRightIcon, CrownIcon, ExitIcon, PlayIcon } from '../components/Icons';
import { ArtistImage, PlayerAvatar } from '../components/Media';
import { PathChain } from '../components/PathChain';
import { formatClock } from '../lib/format';
import { useGame } from '../lib/useGame';

function ranked(players: PlayerPublic[]): PlayerPublic[] {
  const order = (p: PlayerPublic) => (p.status === 'finished' ? 0 : p.status === 'timeout' ? 1 : p.status === 'gaveup' ? 2 : 3);
  return [...players]
    .filter((p) => p.status !== 'idle')
    .sort((a, b) => order(a) - order(b) || (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity) || a.clicks - b.clicks);
}

const MEDALS = ['#ffd34e', '#d7dde4', '#e09a5b'];

export function Results({ state }: { state: RoomState }) {
  const { send, me } = useGame();
  const list = ranked(state.players);
  const winner = list.find((p) => p.status === 'finished');
  const iWon = !!winner && winner.id === me?.id;

  return (
    <AppShell state={state}>
      {iWon && <Confetti pieces={90} />}
      <div className="bg-gradient-to-b from-[#5b2a86] via-[#2a1640] to-sp-base px-5 pb-8 pt-12 sm:px-8">
        <div className="text-sm font-bold">Ergebnis · Runde {state.round}</div>
        <h1 className="mt-2 text-5xl font-black tracking-tight sm:text-7xl">
          {winner ? `${winner.name} gewinnt!` : 'Niemand ist angekommen'}
        </h1>
        {state.start && state.target && (
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-white/85">
            <span className="flex items-center gap-2">
              <ArtistImage artist={state.start} size={28} /> {state.start.name}
            </span>
            <ChevronRightIcon size={16} className="text-white/50" />
            <span className="flex items-center gap-2">
              <ArtistImage artist={state.target} size={28} /> {state.target.name}
            </span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          {me?.isHost ? (
            <button type="button" className="btn-green" onClick={() => send({ t: 'again' })}>
              <PlayIcon size={18} /> Nochmal spielen
            </button>
          ) : (
            <div className="rounded-full bg-black/25 px-5 py-3 text-sm text-white/80">Der Host kann eine neue Runde starten</div>
          )}
          <button type="button" className="btn-outline" onClick={() => send({ t: 'leave' })}>
            <ExitIcon size={16} /> Lobby verlassen
          </button>
        </div>
      </div>

      <div className="space-y-3 px-3 pb-12 sm:px-6">
        {list.map((p, i) => {
          const finished = p.status === 'finished';
          return (
            <div key={p.id} className={`animate-fade-up rounded-lg p-4 sm:p-5 ${p.id === me?.id ? 'bg-white/[0.08]' : 'bg-sp-card'}`} style={{ animationDelay: `${i * 80}ms` }}>
              <div className="mb-4 flex items-center gap-4">
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-black"
                  style={finished && i < 3 ? { background: MEDALS[i], color: '#000' } : { background: 'rgba(255,255,255,.08)', color: '#b3b3b3' }}
                >
                  {finished ? i + 1 : '–'}
                </div>
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
                <div className="flex gap-5 text-right">
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
