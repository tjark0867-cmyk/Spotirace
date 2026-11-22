import type { PlayerPublic, RoomState } from '../../../shared/types';
import { formatClock } from '../lib/format';
import { CrownIcon, FlagIcon, UsersIcon } from './Icons';
import { ArtistImage, PlayerAvatar } from './Media';

function sortPlayers(state: RoomState): PlayerPublic[] {
  if (state.phase === 'lobby') return state.players;
  const rank = (p: PlayerPublic) =>
    p.status === 'finished' ? (p.place ?? 99) : p.status === 'playing' ? 100 : p.status === 'idle' ? 300 : 200;
  return [...state.players].sort((a, b) => rank(a) - rank(b) || b.clicks - a.clicks);
}

function StatusLine({ p, state }: { p: PlayerPublic; state: RoomState }) {
  if (!p.connected) return <span className="text-sp-muted">offline</span>;
  if (state.phase === 'lobby') {
    if (p.isHost) return <span className="text-sp-sub">Host</span>;
    return p.ready ? <span className="font-semibold text-sp-green">Bereit</span> : <span className="text-sp-muted">Nicht bereit</span>;
  }
  if (p.status === 'idle') return <span className="text-sp-muted">schaut zu</span>;
  if (p.status === 'finished') {
    return (
      <span className="font-semibold text-sp-green">
        Platz {p.place} · {formatClock(p.finishMs ?? 0)}
      </span>
    );
  }
  if (p.status === 'gaveup') return <span className="text-sp-red">aufgegeben</span>;
  if (p.status === 'timeout') return <span className="text-sp-muted">Zeit abgelaufen</span>;
  if (p.current) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <ArtistImage artist={p.current} size={16} />
        <span className="truncate">{p.current.name}</span>
      </span>
    );
  }
  return <span className="text-sp-muted">unterwegs …</span>;
}

export function PlayersPanel({ state }: { state: RoomState }) {
  const players = sortPlayers(state);
  const inGame = state.phase !== 'lobby';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <UsersIcon size={20} className="text-sp-sub" /> Spieler
        </h2>
        <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-xs font-semibold text-sp-sub">{players.length}</span>
      </div>
      <ul className="sp-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {players.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-md p-2 transition hover:bg-white/[0.06] ${p.id === state.you ? 'bg-white/[0.04]' : ''}`}
          >
            <div className="relative">
              <PlayerAvatar name={p.name} color={p.color} size={44} dim={!p.connected} />
              {p.status === 'finished' && (
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-sp-green text-black ring-2 ring-sp-base">
                  <FlagIcon size={11} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`truncate font-semibold ${p.id === state.you ? 'text-sp-green-bright' : 'text-white'}`}>{p.name}</span>
                {p.isHost && <CrownIcon size={14} className="shrink-0 text-[#ffc864]" />}
                {p.id === state.you && <span className="shrink-0 text-xs text-sp-muted">(du)</span>}
              </div>
              <div className="flex min-w-0 items-center gap-1.5 text-sm text-sp-sub">
                <StatusLine p={p} state={state} />
              </div>
            </div>
            {inGame && p.status !== 'idle' && (
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold tabular-nums text-white">{p.clicks}</div>
                <div className="text-[10px] uppercase tracking-wider text-sp-muted">Klicks</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
