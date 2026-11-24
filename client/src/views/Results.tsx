import type { PlayerPublic, RoomState } from '../../../shared/types';
import { AppShell } from '../components/AppShell';
import { Confetti } from '../components/Confetti';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRightIcon, ClockIcon, CrownIcon, ExitIcon, FlagIcon, MouseClickIcon, PlayIcon } from '../components/Icons';
import { ArtistImage, PlayerAvatar } from '../components/Media';
import { Medal, MetalNumeral } from '../components/Medal';
import { Crown, Throne } from '../components/Trophy';
import { sound } from '../lib/sound';
import { PathChain } from '../components/PathChain';
import { formatClock } from '../lib/format';
import { useGame } from '../lib/useGame';

function ranked(players: PlayerPublic[]): PlayerPublic[] {
  const order = (p: PlayerPublic) => (p.status === 'finished' ? 0 : p.status === 'timeout' ? 1 : p.status === 'gaveup' ? 2 : 3);
  return [...players]
    .filter((p) => p.status !== 'idle')
    .sort((a, b) => order(a) - order(b) || (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity) || a.clicks - b.clicks);
}

const PODIUM: Record<number, { front: string; top: string; height: string; delay: number; numeral: number }> = {
  1: {
    front: 'from-[#8a6514] via-[#4a370b] to-[#1d1606]',
    top: 'bg-gradient-to-b from-[#fff1a8] to-[#c8901a]',
    height: 'h-[150px] sm:h-[165px]',
    delay: 1.6,
    numeral: 80,
  },
  2: {
    front: 'from-[#5f6871] via-[#30363c] to-[#16191c]',
    top: 'bg-gradient-to-b from-[#ffffff] to-[#9aa5b0]',
    height: 'h-[124px] sm:h-[136px]',
    delay: 1.0,
    numeral: 62,
  },
  3: {
    front: 'from-[#6e3f1c] via-[#3b2410] to-[#1a0f07]',
    top: 'bg-gradient-to-b from-[#ffd9b3] to-[#a85d24]',
    height: 'h-[106px] sm:h-[114px]',
    delay: 0.5,
    numeral: 52,
  },
};

/** Podestblock in 3D-Optik: helle Oberseite, Metall-Front, Namensschild */
function PodiumBlock({ place, p, meId }: { place: number; p: PlayerPublic; meId: string | undefined }) {
  const st = PODIUM[place];
  return (
    <div className="w-full origin-bottom animate-rise" style={{ animationDelay: `${st.delay}s` }}>
      <div className={`h-3 w-full ${st.top}`} style={{ clipPath: 'polygon(6% 0, 94% 0, 100% 100%, 0 100%)' }} />
      <div className={`relative w-full overflow-hidden bg-gradient-to-b ${st.front} ${st.height} shadow-[inset_0_1px_0_rgba(255,255,255,.25)]`}>
        <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-white/10 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/30 to-transparent" />
        <div className="relative flex h-full flex-col items-center justify-between pb-2 pt-1">
          <MetalNumeral place={place} size={st.numeral} />
          <div className="w-[88%] rounded-md bg-black/40 px-1.5 py-1 text-center ring-1 ring-white/15 backdrop-blur-sm">
            <div className={`truncate text-[13px] font-extrabold leading-tight sm:text-sm ${p.id === meId ? 'text-sp-green-bright' : 'text-white'}`}>{p.name}</div>
            <div className="text-[11px] tabular-nums leading-tight text-white/70">
              {formatClock(p.finishMs ?? 0)} · {p.clicks} {p.clicks === 1 ? 'Klick' : 'Klicks'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sparkle({ className, delay }: { className: string; delay: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`absolute animate-twinkle ${className}`} style={{ animationDelay: delay }} aria-hidden>
      <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0Z" fill="#fff3c4" />
    </svg>
  );
}

function Podium({ top, meId }: { top: PlayerPublic[]; meId: string | undefined }) {
  const first = top[0];
  const second = top[1];
  const third = top[2];

  return (
    <div className="relative mx-auto mt-4 flex max-w-xl items-end justify-center gap-1.5 px-2 sm:gap-3">
      {/* Platz 2 */}
      <div className="flex min-w-0 flex-1 flex-col items-center">
        {second && (
          <>
            <div className="mb-2 flex flex-col items-center animate-fade-up" style={{ animationDelay: `${PODIUM[2].delay + 0.3}s` }}>
              <PlayerAvatar name={second.name} color={second.color} size={54} />
              <div className="-mt-3">
                <Medal place={2} size={30} />
              </div>
            </div>
            <PodiumBlock place={2} p={second} meId={meId} />
          </>
        )}
      </div>

      {/* Platz 1 auf dem Thron */}
      <div className="flex min-w-0 flex-[1.3] flex-col items-center">
        <div className="relative flex justify-center animate-fade-up" style={{ animationDelay: `${PODIUM[1].delay + 0.35}s` }}>
          <Throne width={150} />
          <div className="absolute left-1/2 top-[48px] -translate-x-1/2">
            <div className="rounded-full p-[3px] shadow-[0_0_24px_rgba(255,205,70,.65)]" style={{ background: 'linear-gradient(135deg,#fff1a8,#e8a20c,#7a4f06,#ffd23f)' }}>
              <PlayerAvatar name={first.name} color={first.color} size={62} />
            </div>
          </div>
          {/* Krone auf dem Kopf des Siegers */}
          <div className="absolute left-1/2 top-[14px] z-10 -translate-x-1/2 animate-float">
            <Crown width={48} />
          </div>
          <Sparkle className="left-1 top-8 h-4 w-4" delay="0s" />
          <Sparkle className="right-2 top-16 h-3 w-3" delay="0.7s" />
          <Sparkle className="left-6 top-28 h-2.5 w-2.5" delay="1.3s" />
          <Sparkle className="right-5 top-2 h-3.5 w-3.5" delay="1.9s" />
        </div>
        <PodiumBlock place={1} p={first} meId={meId} />
      </div>

      {/* Platz 3 */}
      <div className="flex min-w-0 flex-1 flex-col items-center">
        {third && (
          <>
            <div className="mb-2 flex flex-col items-center animate-fade-up" style={{ animationDelay: `${PODIUM[3].delay + 0.3}s` }}>
              <PlayerAvatar name={third.name} color={third.color} size={50} />
              <div className="-mt-3">
                <Medal place={3} size={28} />
              </div>
            </div>
            <PodiumBlock place={3} p={third} meId={meId} />
          </>
        )}
      </div>
    </div>
  );
}

/** Scheinwerfer, die über die Bühne schwenken */
function Spotlights() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[
        { side: 'left-[8%]', rot: '-18deg', delay: '0s' },
        { side: 'right-[8%]', rot: '18deg', delay: '-3s' },
      ].map((b) => (
        <div
          key={b.side}
          className={`absolute top-[-40px] h-[640px] w-[220px] origin-top animate-sway ${b.side}`}
          style={{ ['--rot' as string]: b.rot, animationDelay: b.delay }}
        >
          <div
            className="h-full w-full bg-gradient-to-b from-[#fff3c4]/30 via-[#fff3c4]/10 to-transparent blur-md"
            style={{ clipPath: 'polygon(44% 0, 56% 0, 100% 100%, 0 100%)' }}
          />
        </div>
      ))}
    </div>
  );
}

/** Kleine Auszeichnungen unter dem Podest */
function Awards({ list }: { list: PlayerPublic[] }) {
  const finishers = list.filter((p) => p.status === 'finished');
  const awards: Array<{ icon: ReactNode; label: string; who: string }> = [];
  if (finishers[0]) awards.push({ icon: <ClockIcon size={15} />, label: 'Schnellste Zeit', who: `${finishers[0].name} · ${formatClock(finishers[0].finishMs ?? 0)}` });
  const fewest = [...finishers].sort((a, b) => a.clicks - b.clicks || (a.finishMs ?? 0) - (b.finishMs ?? 0))[0];
  if (fewest) awards.push({ icon: <MouseClickIcon size={15} />, label: 'Wenigste Klicks', who: `${fewest.name} · ${fewest.clicks}` });
  const most = [...list].sort((a, b) => b.clicks - a.clicks)[0];
  if (most && list.length > 1 && most.clicks > (fewest?.clicks ?? 0)) awards.push({ icon: <FlagIcon size={15} />, label: 'Weltenbummler', who: `${most.name} · ${most.clicks} Klicks` });
  if (awards.length === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2 px-4">
      {awards.map((a, i) => (
        <div
          key={a.label}
          className="flex animate-fade-up items-center gap-2 rounded-full bg-white/[0.07] py-1.5 pl-2 pr-3.5 text-sm ring-1 ring-[#ffd965]/20"
          style={{ animationDelay: `${2.1 + i * 0.15}s` }}
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ffd965]/15 text-[#ffd965]">{a.icon}</span>
          <span className="font-bold text-white">{a.label}</span>
          <span className="text-sp-sub">{a.who}</span>
        </div>
      ))}
    </div>
  );
}

export function Results({ state }: { state: RoomState }) {
  const { send, me } = useGame();
  const list = ranked(state.players);
  const finishers = list.filter((p) => p.status === 'finished');
  const winner = finishers[0];
  const iWon = !!winner && winner.id === me?.id;
  const [celebrate, setCelebrate] = useState(false);

  // Enthüllung: Platz 3 – Platz 2 – Platz 1 (mit Tönen), dann Konfetti
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (finishers[2]) timers.push(setTimeout(() => sound.play('countTick'), PODIUM[3].delay * 1000));
    if (finishers[1]) timers.push(setTimeout(() => sound.play('countTick'), PODIUM[2].delay * 1000));
    if (finishers[0]) {
      timers.push(
        setTimeout(() => {
          sound.play('found');
          setCelebrate(true);
        }, PODIUM[1].delay * 1000 + 300),
      );
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.round]);

  return (
    <AppShell state={state}>
      {celebrate && <Confetti pieces={iWon ? 120 : 60} />}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#3b2a0a] via-[#1b1408] to-sp-base px-5 pb-4 pt-10 sm:px-8">
        <Spotlights />
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
          {finishers.length > 0 && (
            <div className="mt-8">
              <Podium top={finishers.slice(0, 3)} meId={me?.id} />
            </div>
          )}
          <Awards list={list} />
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
