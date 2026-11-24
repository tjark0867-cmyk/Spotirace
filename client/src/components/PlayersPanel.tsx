import { TEAM_COLORS, TEAM_IDS, TEAM_NAMES, type PlayerPublic, type RoomState, type TeamPublic } from '../../../shared/types';
import { formatClock } from '../lib/format';
import { active, isRelay, teamOfPlayer } from '../lib/modes';
import { useServerNow } from '../lib/useGame';
import { ShieldDome } from './art/Effects';
import { IceCrystal, InkBlot } from './art/Items';
import { Baton, TeamCrest } from './art/Team';
import { CrownIcon, FlagIcon, UsersIcon } from './Icons';
import { ArtistImage, PlayerAvatar } from './Media';

function sortPlayers(state: RoomState): PlayerPublic[] {
  if (state.phase === 'lobby') return state.players;
  const rank = (p: PlayerPublic) =>
    p.status === 'finished' ? (p.place ?? 99) : p.status === 'playing' ? 100 : p.status === 'idle' ? 300 : 200;
  return [...state.players].sort((a, b) => rank(a) - rank(b) || b.clicks - a.clicks);
}

/** Avatar mit Schild-Kuppel, Frost- oder Tinten-Abzeichen */
export function EffectAvatar({ p, size, now }: { p: PlayerPublic; size: number; now: number }) {
  const shield = active(p.effects.shieldUntil, now);
  const frozen = active(p.effects.frozenUntil, now);
  const inked = active(p.effects.inkUntil, now);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PlayerAvatar name={p.name} color={p.color} size={size} dim={!p.connected} />
      {frozen && <div className="absolute inset-0 rounded-full bg-[#bfeeff]/45 ring-2 ring-[#bfeeff]" />}
      {shield && <ShieldDome size={size} color={p.team ? TEAM_COLORS[p.team] : undefined} />}
      {frozen && <IceCrystal size={Math.round(size * 0.5)} className="absolute -right-1.5 -top-1.5" />}
      {inked && <InkBlot size={Math.round(size * 0.5)} className="absolute -bottom-1.5 -left-1.5" />}
    </div>
  );
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

/** Staffel: läuft gerade / wartet auf den Stab / Etappe geschafft */
function RelayLine({ p, team, now }: { p: PlayerPublic; team: TeamPublic; now: number }) {
  if (!p.connected) return <span className="text-sp-muted">offline</span>;
  if (team.status === 'finished') return <span className="font-semibold text-sp-green">im Ziel · Platz {team.place}</span>;
  if (team.status === 'gaveup') return <span className="text-sp-red">aufgegeben</span>;
  if (team.status === 'timeout') return <span className="text-sp-muted">Zeit abgelaufen</span>;
  const leg = team.legs[team.active];
  if (leg?.runnerId === p.id) {
    const waiting = leg.startAt !== null && leg.startAt > now;
    return (
      <span className="flex min-w-0 items-center gap-1.5 font-semibold" style={{ color: TEAM_COLORS[team.id] }}>
        <Baton size={18} className="shrink-0" />
        {waiting ? (
          <span className="truncate">übernimmt den Stab …</span>
        ) : p.current ? (
          <>
            <ArtistImage artist={p.current} size={16} />
            <span className="truncate text-sp-sub">{p.current.name}</span>
          </>
        ) : (
          <span className="truncate">läuft</span>
        )}
      </span>
    );
  }
  const done = team.legs.filter((l) => l.runnerId === p.id && l.endAt && l.startAt);
  if (done.length > 0) {
    const l = done[done.length - 1];
    return (
      <span className="text-sp-sub">
        Etappe {l.index + 1} geschafft · {formatClock((l.endAt ?? 0) - (l.startAt ?? 0))}
      </span>
    );
  }
  const mine = team.legs.find((l) => l.runnerId === p.id && !l.endAt);
  return <span className="text-sp-muted">{mine ? `wartet auf den Stab (Etappe ${mine.index + 1})` : 'feuert an'}</span>;
}

function Row({ p, state, now, team }: { p: PlayerPublic; state: RoomState; now: number; team: TeamPublic | null }) {
  const inGame = state.phase !== 'lobby';
  return (
    <li className={`flex items-center gap-3 rounded-md p-2 transition hover:bg-white/[0.06] ${p.id === state.you ? 'bg-white/[0.04]' : ''}`}>
      <div className="relative">
        <EffectAvatar p={p} size={44} now={now} />
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
          {team && inGame ? <RelayLine p={p} team={team} now={now} /> : <StatusLine p={p} state={state} />}
        </div>
      </div>
      {inGame && p.status !== 'idle' && (
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums text-white">{p.clicks}</div>
          <div className="text-[10px] uppercase tracking-wider text-sp-muted">Klicks</div>
        </div>
      )}
    </li>
  );
}

export function PlayersPanel({ state }: { state: RoomState }) {
  const now = useServerNow(1000);
  const players = sortPlayers(state);
  const teamsView = !!state.teams;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <UsersIcon size={20} className="text-sp-sub" /> Spieler
        </h2>
        <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-xs font-semibold text-sp-sub">{players.length}</span>
      </div>
      <div className="sp-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {teamsView ? (
          <>
            {TEAM_IDS.map((id) => {
              const team = state.teams!.find((t) => t.id === id)!;
              const members = team.members.map((m) => state.players.find((p) => p.id === m)).filter((p): p is PlayerPublic => !!p);
              return (
                <div key={id} className="mb-2">
                  <div className="flex items-center gap-2 px-2 pb-1 pt-2">
                    <TeamCrest team={id} size={24} />
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: TEAM_COLORS[id] }}>
                      {TEAM_NAMES[id]}
                    </span>
                    {isRelay(state) && <span className="ml-auto text-xs tabular-nums text-sp-muted">{team.clicks} Klicks</span>}
                  </div>
                  <ul className="space-y-0.5">
                    {members.map((p) => (
                      <Row key={p.id} p={p} state={state} now={now} team={teamOfPlayer(state, p.id)} />
                    ))}
                  </ul>
                </div>
              );
            })}
            {players.some((p) => !state.teams!.some((t) => t.members.includes(p.id))) && (
              <div>
                <div className="px-2 pb-1 pt-2 text-xs font-bold uppercase tracking-widest text-sp-muted">Zuschauer</div>
                <ul className="space-y-0.5">
                  {players
                    .filter((p) => !state.teams!.some((t) => t.members.includes(p.id)))
                    .map((p) => (
                      <Row key={p.id} p={p} state={state} now={now} team={null} />
                    ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <ul className="space-y-0.5">
            {players.map((p) => (
              <Row key={p.id} p={p} state={state} now={now} team={null} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
