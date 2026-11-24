import { Fragment, useRef, useState } from 'react';
import { CHEER_KINDS, TEAM_COLORS, TEAM_NAMES, type CheerKind, type FxEvent, type RoomState, type TeamPublic } from '../../../shared/types';
import { Baton, CheerSticker, TeamCrest, ZoneBanner } from '../components/art/Team';
import { Confetti } from '../components/Confetti';
import { ArtistImage, PlayerAvatar } from '../components/Media';
import { PathChain } from '../components/PathChain';
import { EffectAvatar } from '../components/PlayersPanel';
import { formatClock } from '../lib/format';
import { activeLeg, myTeam, playerName } from '../lib/modes';
import { sound } from '../lib/sound';
import { useFx, useGame, useServerNow } from '../lib/useGame';

const CHEER_LABEL: Record<CheerKind, string> = { flame: 'Feuer!', thumb: 'Stark!', bolt: 'Schneller!' };

// ---------- Strecke A → B → C ----------

export function RouteStrip({ team, size = 48 }: { team: TeamPublic; size?: number }) {
  const color = TEAM_COLORS[team.id];
  const points = [team.legs[0].from, ...team.legs.map((l) => l.to)];
  return (
    <div className="flex items-start" aria-label="Strecke der Staffel">
      {points.map((a, i) => {
        const leg = team.legs[i - 1];
        const done = !!leg?.endAt;
        const running = !!leg && !done && leg.index === team.active && team.status === 'playing';
        const reached = i === 0 || done;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <div className="relative mx-1 flex-1" style={{ marginTop: size / 2 - 2 }}>
                <div
                  className="h-1 rounded-full"
                  style={{
                    background: done ? color : running ? `repeating-linear-gradient(90deg, ${color} 0 8px, transparent 8px 14px)` : 'rgba(255,255,255,.15)',
                  }}
                />
                {running && (
                  <div className="absolute left-1/2 top-1/2 -ml-4 -mt-4">
                    <Baton size={32} />
                  </div>
                )}
              </div>
            )}
            <div className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center">
              <ArtistImage artist={a} size={size} className={reached ? 'ring-2' : 'opacity-70'} />
              <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: i === points.length - 1 ? '#f573a0' : i === 0 ? '#1ed760' : '#ffc864' }}>
                {i === 0 ? 'Start' : i === points.length - 1 ? 'Ziel' : 'Wechsel'}
              </div>
              <div className="line-clamp-2 text-[11px] font-semibold leading-tight">{a.name}</div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

// ---------- Live zuschauen (ohne eigene Spotify-Anfragen) ----------

export function SpectatorView({ state }: { state: RoomState }) {
  const { send } = useGame();
  const now = useServerNow(250);
  const [cheerReady, setCheerReady] = useState(0);
  const team = myTeam(state);
  const leg = activeLeg(team);
  if (!team || !leg) return null;
  const color = TEAM_COLORS[team.id];
  const runner = state.players.find((p) => p.id === leg.runnerId);
  const other = state.teams!.find((t) => t.id !== team.id)!;
  const otherLeg = activeLeg(other);
  const handing = leg.startAt !== null && leg.startAt > now;
  const legTime = leg.startAt ? Math.max(0, (leg.endAt ?? now) - leg.startAt) : 0;
  const myLegs = team.legs.filter((l) => l.runnerId === state.you);
  const upcoming = myLegs.find((l) => l.index > team.active);
  const finishedMine = myLegs.filter((l) => l.endAt && l.startAt);
  const takeover = team.takeoverAt;
  const canTake = takeover !== null && now >= takeover;

  const cheer = (kind: CheerKind) => {
    if (Date.now() < cheerReady) return;
    setCheerReady(Date.now() + 1300);
    sound.play('cheer');
    send({ t: 'cheer', sticker: kind });
  };

  return (
    <div className="min-h-full pb-10" style={{ background: `linear-gradient(180deg, ${color}55 0, ${color}14 280px, transparent 560px)` }}>
      <div className="px-5 pt-8 sm:px-8">
        <div className="flex items-center gap-4">
          <TeamCrest team={team.id} size={64} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white/80">
              Etappe {team.active + 1} von {team.legs.length} · Live
            </div>
            <h1 className="truncate text-3xl font-black tracking-tight sm:text-5xl">{TEAM_NAMES[team.id]}</h1>
          </div>
        </div>
        <div className="mt-6 rounded-xl bg-black/25 p-3 sm:p-4">
          <RouteStrip team={team} />
        </div>
      </div>

      {/* Läufer live */}
      <section className="mx-3 mt-4 rounded-xl bg-black/30 p-4 sm:mx-6 sm:p-6" aria-label="Läufer live">
        <div className="flex items-center gap-4 sm:gap-6">
          {leg.current ? <ArtistImage artist={leg.current} size={104} className="shadow-xl" /> : <div className="h-[104px] w-[104px] rounded-full skeleton" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {runner && <EffectAvatar p={runner} size={26} now={now} />}
              <span className="truncate text-sm font-bold" style={{ color }}>
                {handing ? `${leg.runnerName} übernimmt den Stab …` : `${leg.runnerName} läuft${runner?.connected === false ? ' (offline)' : ''}`}
              </span>
            </div>
            <div className="mt-1 truncate text-2xl font-black tracking-tight sm:text-4xl">{leg.current?.name ?? '…'}</div>
            <div className="mt-1 truncate text-sm text-sp-sub">
              Etappenziel: <b className="text-white">{leg.to.name}</b>
            </div>
            <div className="mt-2 flex gap-5 text-sm">
              <span>
                <b className="tabular-nums">{formatClock(legTime)}</b> <span className="text-sp-muted">Etappe</span>
              </span>
              <span>
                <b className="tabular-nums">{leg.clicks}</b> <span className="text-sp-muted">{leg.clicks === 1 ? 'Klick' : 'Klicks'}</span>
              </span>
            </div>
          </div>
        </div>
        {leg.path && leg.path.length > 1 && (
          <div className="mt-5">
            <PathChain path={leg.path} targetId={leg.to.id} />
          </div>
        )}
      </section>

      {/* Übernehmen, wenn der Läufer weg ist */}
      {takeover !== null && (
        <section className="mx-3 mt-4 flex flex-col gap-3 rounded-xl border border-[#ffc864]/40 bg-[#ffc864]/10 p-4 sm:mx-6 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 text-sm">
            <b>{leg.runnerName} ist offline.</b>{' '}
            {canTake ? 'Du kannst jetzt für das Team weiterlaufen.' : `In ${Math.ceil((takeover - now) / 1000)} s darf jemand aus dem Team übernehmen.`}
          </div>
          <button type="button" className="btn-green shrink-0 px-6 py-2.5 text-sm" disabled={!canTake} onClick={() => send({ t: 'takeover' })}>
            <Baton size={22} /> Übernehmen
          </button>
        </section>
      )}

      {/* Anfeuern */}
      <section className="mx-3 mt-4 rounded-xl bg-white/[0.04] p-4 sm:mx-6" aria-label="Anfeuern">
        <div className="text-xs font-bold uppercase tracking-widest text-sp-sub">Anfeuern</div>
        <div className="mt-3 flex gap-3">
          {CHEER_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => cheer(k)}
              className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-white/[0.05] py-3 transition hover:scale-105 hover:bg-white/[0.1] active:scale-95"
              aria-label={`Anfeuern: ${CHEER_LABEL[k]}`}
            >
              <CheerSticker kind={k} size={52} />
              <span className="text-xs font-bold">{CHEER_LABEL[k]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Deine Rolle */}
      <section className="mx-3 mt-4 rounded-xl bg-white/[0.04] p-4 text-sm sm:mx-6">
        {upcoming ? (
          <p>
            <b>Du läufst Etappe {upcoming.index + 1}:</b> von <b>{upcoming.from.name}</b> nach <b>{upcoming.to.name}</b>. Halte dich bereit – sobald du den
            Stab bekommst, geht’s automatisch los.
          </p>
        ) : finishedMine.length > 0 ? (
          <p>
            <b>Deine Etappe ist geschafft:</b>{' '}
            {finishedMine.map((l) => `${formatClock((l.endAt ?? 0) - (l.startAt ?? 0))} · ${l.clicks} ${l.clicks === 1 ? 'Klick' : 'Klicks'}`).join(', ')}. Jetzt heißt es
            anfeuern!
          </p>
        ) : (
          <p className="text-sp-sub">Du schaust deinem Team zu.</p>
        )}
      </section>

      {/* Gegner */}
      <section className="mx-3 mt-4 flex items-center gap-3 rounded-xl bg-white/[0.04] p-4 sm:mx-6" aria-label="Gegner">
        <TeamCrest team={other.id} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-bold" style={{ color: TEAM_COLORS[other.id] }}>
            {TEAM_NAMES[other.id]}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-sp-sub">
            {other.status === 'finished' ? (
              `im Ziel · ${formatClock(other.finishMs ?? 0)}`
            ) : other.status !== 'playing' ? (
              other.status === 'gaveup' ? 'aufgegeben' : 'Zeit abgelaufen'
            ) : (
              <>
                <span className="shrink-0">
                  Etappe {other.active + 1}/{other.legs.length}
                </span>
                {otherLeg?.current && (
                  <>
                    <span>·</span>
                    <ArtistImage artist={otherLeg.current} size={16} />
                    <span className="truncate">{otherLeg.current.name}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold tabular-nums">{other.clicks}</div>
          <div className="text-[10px] uppercase tracking-wider text-sp-muted">Klicks</div>
        </div>
      </section>
    </div>
  );
}

// ---------- Team ist fertig, das andere läuft noch ----------

export function RelayDonePanel({ state, team }: { state: RoomState; team: TeamPublic }) {
  const other = state.teams!.find((t) => t.id !== team.id)!;
  const finished = team.status === 'finished';
  const title = finished ? 'Im Ziel!' : team.status === 'gaveup' ? 'Aufgegeben' : 'Zeit abgelaufen';
  return (
    <div className="min-h-full px-5 pb-12 pt-10 sm:px-8" style={{ background: `linear-gradient(180deg, ${TEAM_COLORS[team.id]}55, transparent 520px)` }}>
      {finished && <Confetti />}
      <div className="flex animate-fade-up items-center gap-4">
        <TeamCrest team={team.id} size={84} />
        <div>
          <div className="text-sm font-bold uppercase tracking-widest" style={{ color: TEAM_COLORS[team.id] }}>
            {TEAM_NAMES[team.id]}
            {finished && ` · Platz ${team.place}`}
          </div>
          <h1 className="mt-1 text-5xl font-black tracking-tight sm:text-7xl">{title}</h1>
        </div>
      </div>
      {finished && (
        <p className="mt-4 text-lg text-white/85">
          Teamzeit <b>{formatClock(team.finishMs ?? 0)}</b> mit <b>{team.clicks}</b> {team.clicks === 1 ? 'Klick' : 'Klicks'}.
        </p>
      )}
      <div className="mt-8 rounded-xl bg-black/25 p-4">
        <RouteStrip team={team} />
      </div>
      <div className="mt-8 text-sp-sub">
        {other.status === 'playing' ? `Warte auf ${TEAM_NAMES[other.id]} …` : 'Gleich kommt das Ergebnis.'}
      </div>
    </div>
  );
}

// ---------- Übergabe-Animation ----------

type HandoverFx = Extract<FxEvent, { kind: 'handover' }>;

function HandoverOverlay({ state, fx }: { state: RoomState; fx: HandoverFx }) {
  const now = useServerNow(100);
  const color = TEAM_COLORS[fx.team];
  const from = state.players.find((p) => p.id === fx.from);
  const to = state.players.find((p) => p.id === fx.to);
  const mine = fx.to === state.you;
  const left = Math.max(0, Math.ceil((fx.startAt - now) / 1000));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 px-4 backdrop-blur-sm" role="dialog" aria-label="Stab-Übergabe">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="animate-banner">
          <ZoneBanner team={fx.team} width={Math.min(360, window.innerWidth - 32)} />
        </div>
        <div className="relative mt-10 flex w-full max-w-[340px] items-start justify-between">
          {[from, to].map((p, i) => (
            <div key={i} className="flex w-24 flex-col items-center gap-2">
              <div className="rounded-full p-[3px]" style={{ background: i === 1 ? color : 'rgba(255,255,255,.25)' }}>
                {p ? <PlayerAvatar name={p.name} color={p.color} size={64} /> : <div className="h-16 w-16 rounded-full bg-white/10" />}
              </div>
              <div className="w-full truncate text-sm font-bold">{p?.id === state.you ? 'Du' : (p?.name ?? '?')}</div>
            </div>
          ))}
          <div
            className="pointer-events-none absolute left-1/2 top-0 -ml-[36px] animate-baton"
            style={{ ['--from' as string]: '-122px', ['--to' as string]: '118px' }}
          >
            <Baton size={72} motion />
          </div>
        </div>
        <div className="mt-8 flex items-center gap-3 rounded-full bg-white/[0.07] py-2 pl-2 pr-5">
          <ArtistImage artist={fx.at} size={48} />
          <div className="text-left">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#ffc864]">Wechsel bei</div>
            <div className="text-lg font-black leading-tight">{fx.at.name}</div>
          </div>
        </div>
        <div className="mt-7 animate-pop text-4xl font-black tracking-tight sm:text-5xl" style={{ color }}>
          {mine ? 'Du bist dran!' : `${to?.name ?? 'Läufer'} läuft los!`}
        </div>
        <div className="mt-2 text-sp-sub">{mine ? (left > 0 ? `Los geht’s in ${left} …` : 'Los!') : `Etappe ${fx.leg + 1} beginnt`}</div>
      </div>
    </div>
  );
}

// ---------- Ereignisse der Staffel: Übergabe, Übernahme, Sticker ----------

interface FlyingSticker {
  id: number;
  kind: CheerKind;
  by: string;
  x: number;
  rot: number;
}

export function RelayFx({ state }: { state: RoomState }) {
  const { toast, serverNow } = useGame();
  const [handover, setHandover] = useState<HandoverFx | null>(null);
  const [stickers, setStickers] = useState<FlyingSticker[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const nextId = useRef(0);

  useFx((fx) => {
    const s = stateRef.current;
    const mine = myTeam(s);
    if (fx.kind === 'handover') {
      if (mine?.id === fx.team) {
        sound.play('handover');
        setHandover(fx);
        const ms = Math.max(1800, fx.startAt - serverNow() + 350);
        setTimeout(() => setHandover((h) => (h === fx ? null : h)), ms);
      } else {
        toast(`${TEAM_NAMES[fx.team]}: Wechsel bei ${fx.at.name}`, 'info', <Baton size={30} />);
      }
    } else if (fx.kind === 'takeover') {
      if (mine?.id === fx.team) {
        sound.play('cheer');
        toast(`${playerName(s, fx.by)} übernimmt für ${playerName(s, fx.from)}`, 'info', <Baton size={30} />);
      }
    } else if (fx.kind === 'cheer') {
      if (fx.by !== s.you) sound.play('cheer');
      const id = ++nextId.current;
      const sticker: FlyingSticker = { id, kind: fx.sticker, by: fx.by === s.you ? 'Du' : playerName(s, fx.by), x: 10 + Math.random() * 60, rot: Math.random() * 40 - 20 };
      setStickers((list) => [...list.slice(-5), sticker]);
      setTimeout(() => setStickers((list) => list.filter((x) => x.id !== id)), 2300);
    }
  });

  return (
    <>
      {handover && <HandoverOverlay state={state} fx={handover} />}
      <div className="pointer-events-none fixed bottom-44 right-2 z-40 h-64 w-48 sm:right-6" aria-live="polite">
        {stickers.map((st) => (
          <div
            key={st.id}
            className="absolute bottom-0 flex animate-sticker flex-col items-center"
            style={{ left: `${st.x}%`, ['--dx' as string]: `${st.rot}px`, ['--rot' as string]: `${st.rot}deg` }}
          >
            <CheerSticker kind={st.kind} size={72} />
            <span className="mt-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold">{st.by}</span>
          </div>
        ))}
      </div>
    </>
  );
}
