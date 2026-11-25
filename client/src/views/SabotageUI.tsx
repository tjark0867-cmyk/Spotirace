import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ATTACK_ITEMS, ITEM_INFO, MAX_ITEMS, TEAM_COLORS, type ItemKind, type RoomState } from '../../../shared/types';
import { CrateReveal, FrostOverlay, InkOverlay } from '../components/art/Effects';
import { CheatSheet, ItemCrate, ItemIcon, MasterKey, ShieldArt } from '../components/art/Items';
import { CloseIcon } from '../components/Icons';
import { ArtistImage, Cover } from '../components/Media';
import { EffectAvatar } from '../components/PlayersPanel';
import { ITEM_ASK, ITEM_VERB, active, amRunner, attackTargets, isRelay, myTeam, playerName, secondsLeft } from '../lib/modes';
import { sound } from '../lib/sound';
import { useFx, useGame, useServerNow } from '../lib/useGame';

/** Farbe für das eigene Schild: Teamfarbe in der Staffel, sonst Blau */
export function shieldColor(state: RoomState): string | undefined {
  const team = myTeam(state);
  return team ? TEAM_COLORS[team.id] : undefined;
}

// ---------- Inventar-Leiste über der Player-Bar ----------

export function InventoryBar({ state, onPick }: { state: RoomState; onPick: (slot: number, item: ItemKind) => void }) {
  const { send, toast, me } = useGame();
  const now = useServerNow(250);
  const sab = state.sabotage!;
  const canAct = state.phase === 'playing' && amRunner(state);
  const cooldown = Math.max(0, sab.attackReadyAt - now);
  const fx = me?.effects;
  const shownEffects: Array<{ key: string; art: ReactNode; until: number | null; label: string }> = [
    { key: 'shield', art: <ShieldArt size={24} color={shieldColor(state)} />, until: fx?.shieldUntil ?? null, label: 'Schild' },
    { key: 'key', art: <MasterKey size={24} />, until: fx?.keyUntil ?? null, label: 'Schlüssel' },
    { key: 'peek', art: <CheatSheet size={24} />, until: fx?.peekUntil ?? null, label: 'Spickzettel' },
  ].filter((e) => active(e.until, now));

  const use = (slot: number) => {
    const item = sab.items[slot];
    if (!item || !canAct) return;
    if (ATTACK_ITEMS.includes(item)) {
      if (cooldown > 0) {
        sound.play('denied');
        toast(`Abklingzeit – noch ${Math.ceil(cooldown / 1000)} s bis zum nächsten Angriff`, 'error');
        return;
      }
      if (attackTargets(state).length === 0) {
        sound.play('denied');
        toast('Gerade ist niemand angreifbar', 'error');
        return;
      }
      sound.play('tap');
      onPick(slot, item);
      return;
    }
    send({ t: 'useItem', slot });
  };

  return (
    <div className="flex h-[58px] shrink-0 items-center gap-2 rounded-lg bg-sp-base px-2 sm:gap-4 sm:px-4" aria-label="Inventar">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {Array.from({ length: MAX_ITEMS }, (_, i) => {
          const item = sab.items[i];
          const attack = !!item && ATTACK_ITEMS.includes(item);
          const cooling = attack && cooldown > 0;
          return (
            <button
              key={`${i}-${item ?? 'leer'}`}
              type="button"
              disabled={!item || !canAct}
              onClick={() => use(i)}
              title={item ? `${ITEM_INFO[item].name}: ${ITEM_INFO[item].text}` : 'Leeres Fach'}
              aria-label={item ? `${ITEM_INFO[item].name} benutzen` : 'Leeres Fach'}
              className={`relative grid h-[46px] w-[46px] place-items-center rounded-lg transition sm:w-auto sm:grid-cols-[40px_auto] sm:gap-2 sm:px-1.5 sm:pr-3 ${
                item
                  ? 'bg-gradient-to-b from-white/[0.14] to-white/[0.05] ring-1 ring-white/20 enabled:hover:scale-105 enabled:hover:ring-white/50'
                  : 'border border-dashed border-white/15 bg-black/20'
              }`}
            >
              {item ? (
                <>
                  <span className="animate-slot-in">
                    <ItemIcon kind={item} size={40} color={shieldColor(state)} />
                  </span>
                  <span className="hidden text-left text-xs font-bold leading-tight sm:block">{ITEM_INFO[item].name}</span>
                  {cooling && (
                    <span
                      className="absolute inset-0 grid place-items-center rounded-lg bg-black/60 text-xs font-black tabular-nums"
                      style={{ background: `conic-gradient(rgba(0,0,0,.25) ${(1 - cooldown / 20_000) * 360}deg, rgba(0,0,0,.72) 0)` }}
                    >
                      {Math.ceil(cooldown / 1000)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[10px] font-bold uppercase text-white/25">leer</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fortschritt bis zur nächsten Kiste */}
      <div className="flex min-w-0 items-center gap-2" title="Nach jedem 2. Sprung gibt es eine Item-Kiste">
        <ItemCrate size={34} glow={sab.crateIn === 0} />
        <div className="min-w-0">
          <div className="flex gap-1">
            {[0, 1].map((i) => (
              <span key={i} className={`h-1.5 w-4 rounded-full ${i < 2 - sab.crateIn ? 'bg-[#ffd76a]' : 'bg-white/15'}`} />
            ))}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold text-sp-sub">
            {sab.crateIn === 0 ? 'Kiste wartet – Fach frei machen' : `Kiste in ${sab.crateIn} ${sab.crateIn === 1 ? 'Sprung' : 'Sprüngen'}`}
          </div>
        </div>
      </div>

      {/* Laufende eigene Effekte */}
      <div className="ml-auto flex items-center gap-1.5">
        {shownEffects.map((e) => (
          <div key={e.key} className="flex items-center gap-1 rounded-full bg-white/[0.07] py-1 pl-1 pr-2.5" title={e.label}>
            {e.art}
            <span className="text-xs font-bold tabular-nums">{secondsLeft(e.until, now)} s</span>
          </div>
        ))}
        {cooldown > 0 && shownEffects.length === 0 && (
          <div className="hidden text-xs text-sp-muted sm:block">Angriff wieder in {Math.ceil(cooldown / 1000)} s</div>
        )}
      </div>
    </div>
  );
}

// ---------- Gegner auswählen ----------

export function TargetPicker({ state, slot, item, onClose }: { state: RoomState; slot: number; item: ItemKind; onClose: () => void }) {
  const { send } = useGame();
  const now = useServerNow(500);
  const targets = attackTargets(state);

  useEffect(() => {
    if (targets.length === 0) onClose();
  }, [targets.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md animate-fade-up rounded-t-2xl bg-sp-elevated p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <ItemIcon kind={item} size={68} animate />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-widest text-sp-sub">{ITEM_INFO[item].name}</div>
            <div className="text-xl font-extrabold leading-tight">{ITEM_ASK[item]}</div>
            <div className="mt-0.5 text-sm text-sp-sub">{ITEM_INFO[item].text}</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-full hover:bg-white/10" aria-label="Abbrechen">
            <CloseIcon size={18} />
          </button>
        </div>
        <ul className="mt-5 space-y-2">
          {targets.map((p) => {
            const shielded = active(p.effects.shieldUntil, now);
            const same =
              (item === 'freeze' && active(p.effects.frozenUntil, now)) || (item === 'ink' && active(p.effects.inkUntil, now));
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={same}
                  onClick={() => {
                    sound.play('attack');
                    send({ t: 'useItem', slot, targetId: p.id });
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg bg-white/[0.05] p-3 text-left transition enabled:hover:bg-white/[0.1] disabled:opacity-45"
                >
                  <EffectAvatar p={p} size={48} now={now} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.name}</div>
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-sp-sub">
                      {same ? (
                        'Wirkt schon – stapelt nicht'
                      ) : p.current ? (
                        <>
                          <ArtistImage artist={p.current} size={16} />
                          <span className="truncate">{p.current.name}</span>
                        </>
                      ) : (
                        'unterwegs'
                      )}
                    </div>
                  </div>
                  {shielded && <span className="shrink-0 rounded-full bg-[#509bf5]/20 px-2 py-0.5 text-[11px] font-bold text-[#8fc0ff]">Schild!</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ---------- Spickzettel ----------

export function PeekCard({ state }: { state: RoomState }) {
  const now = useServerNow(250);
  const { me } = useGame();
  const peek = state.sabotage?.peek;
  const until = me?.effects.peekUntil;
  const [hidden, setHidden] = useState<number | null>(null);
  if (!peek || !active(until, now) || hidden === until) return null;
  return (
    <div className="fixed right-3 top-16 z-30 w-[min(92vw,300px)] animate-fade-up overflow-hidden rounded-xl bg-[#fbf2dc] text-[#2a2f5a] shadow-[0_16px_40px_rgba(0,0,0,.6)] lg:top-4">
      <div className="flex items-center gap-3 border-b border-[#2a2f5a]/15 px-3 py-2.5">
        <CheatSheet size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-widest text-[#2a2f5a]/60">Spickzettel · {secondsLeft(until, now)} s</div>
          <div className="truncate font-extrabold">{peek.artist.name}</div>
        </div>
        <button type="button" onClick={() => setHidden(until ?? null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/10" aria-label="Spickzettel schließen">
          <CloseIcon size={16} />
        </button>
      </div>
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap gap-1.5">
          {peek.genres.length > 0 ? (
            peek.genres.map((g) => (
              <span key={g} className="rounded-full bg-[#2a2f5a] px-2.5 py-0.5 text-xs font-bold text-[#fbf2dc]">
                {g}
              </span>
            ))
          ) : (
            <span className="text-xs font-semibold text-[#2a2f5a]/60">Keine Genres bekannt – schau auf die Cover</span>
          )}
        </div>
        {peek.covers.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {peek.covers.map((c) => (
              <div key={c.id} className="min-w-0">
                <Cover src={c.cover} alt={c.name} className="w-full shadow-md" rounded="rounded" />
                <div className="mt-1 truncate text-[10px] font-bold">{c.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Overlays für eigene Effekte ----------

export function EffectOverlays({ state }: { state: RoomState }) {
  const now = useServerNow(250);
  const { me } = useGame();
  if (!me || state.phase !== 'playing') return null;
  return (
    <>
      {active(me.effects.inkUntil, now) && <InkOverlay />}
      {active(me.effects.frozenUntil, now) && <FrostOverlay secondsLeft={secondsLeft(me.effects.frozenUntil, now)} />}
    </>
  );
}

// ---------- Effekt-Ereignisse: Kiste, Angriffe, Sounds, Einblendungen ----------

export function SabotageFx({ state }: { state: RoomState }) {
  const { toast } = useGame();
  const [crate, setCrate] = useState<{ item: ItemKind; key: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useFx((fx) => {
    const s = stateRef.current;
    const me = s.you;
    if (fx.kind === 'crate' && fx.player === me) {
      sound.play('crate');
      const key = Date.now();
      setCrate({ item: fx.item, key });
      setTimeout(() => setCrate((c) => (c?.key === key ? null : c)), 2700);
      setTimeout(() => toast(`${ITEM_INFO[fx.item].name}: ${ITEM_INFO[fx.item].text}`, 'success', <ItemIcon kind={fx.item} size={30} color={shieldColor(s)} />), 1500);
      return;
    }
    if (fx.kind === 'crateFull' && fx.player === me) {
      sound.play('crateFull');
      toast('Inventar voll – benutz ein Item, dann wartet die nächste Kiste auf dich', 'info', <ItemCrate size={30} />);
      return;
    }
    if (fx.kind !== 'item') return;
    const icon = <ItemIcon kind={fx.item} size={30} color={shieldColor(s)} />;
    const from = playerName(s, fx.from);
    const to = playerName(s, fx.to);
    if (!ATTACK_ITEMS.includes(fx.item)) {
      // Eigene Items: Sound reicht – Schild-Kuppel, Schlüssel-Leuchten und Spickzettel zeigen den Rest
      if (fx.from === me) sound.play(fx.item === 'shield' ? 'shield' : fx.item === 'key' ? 'key' : 'peek');
      return;
    }
    if (fx.to === me) {
      if (fx.blocked) {
        sound.play('blocked');
        toast(`${from} wollte dich angreifen – dein Schild hat geblockt!`, 'success', <ShieldArt size={30} color={shieldColor(s)} />);
      } else {
        sound.play(fx.item as 'freeze' | 'ink' | 'rewind');
        toast(`${from} hat dich ${ITEM_VERB[fx.item]}!`, 'attack', icon);
      }
      return;
    }
    if (fx.from === me) {
      if (fx.blocked) {
        sound.play('blocked');
        toast(`${to} hatte ein Schild – geblockt!`, 'error', <ShieldArt size={30} />);
      } else {
        toast(`Treffer! ${to} ist ${ITEM_VERB[fx.item]}.`, 'success', icon);
      }
      return;
    }
    // Staffel: Teamkollegen sehen, was ihrem Läufer passiert
    const mine = myTeam(s);
    if (isRelay(s) && mine && fx.to && mine.members.includes(fx.to)) {
      toast(fx.blocked ? `${to} hat ${from}s Angriff geblockt` : `${from} hat ${to} ${ITEM_VERB[fx.item]}`, 'attack', icon);
    }
  });

  return crate ? <CrateReveal key={crate.key} item={crate.item} color={shieldColor(state)} /> : null;
}
