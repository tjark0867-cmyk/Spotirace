import { ITEM_INFO, ITEM_KINDS, TEAM_COLORS, TEAM_IDS, TEAM_NAMES, type GameMode, type GameSettings, type RoomState, type TeamId, type TimeLimit } from '../../../shared/types';
import { AppShell } from '../components/AppShell';
import { ArtistPicker } from '../components/ArtistPicker';
import { UsageCard } from '../components/UsageCard';
import { useConfig } from '../lib/useConfig';
import { ArrowRightIcon, CheckIcon, CopyIcon, CrownIcon, PlayIcon, ShuffleIcon } from '../components/Icons';
import { useEffect, type ReactNode } from 'react';
import { api } from '../lib/api';
import { sound } from '../lib/sound';
import { copyText, useGame } from '../lib/useGame';
import { PlayerAvatar } from '../components/Media';
import { Medal } from '../components/Medal';
import { ItemIcon } from '../components/art/Items';
import { Baton, TeamCrest } from '../components/art/Team';
import { teamSize } from '../lib/modes';

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-sp-green' : 'bg-sp-muted/60'} ${disabled ? 'opacity-70' : ''}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

function SettingsCard({ settings, editable }: { settings: GameSettings; editable: boolean }) {
  const { send } = useGame();
  const set = (s: Partial<GameSettings>) => {
    sound.play('tap');
    send({ t: 'settings', settings: s });
  };
  const limits: TimeLimit[] = [0, 5, 10, 15];
  return (
    <div className="rounded-lg bg-sp-card p-5">
      <div className="mb-4 text-xs font-bold uppercase tracking-widest text-sp-sub">Einstellungen</div>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Zeitlimit</div>
            <div className="text-sm text-sp-sub">Wer bis dahin nicht im Ziel ist, scheidet aus</div>
          </div>
          <div className="flex gap-1.5">
            {limits.map((m) => (
              <button
                key={m}
                type="button"
                disabled={!editable}
                onClick={() => set({ timeLimitMin: m })}
                className={`chip ${settings.timeLimitMin === m ? 'chip-active' : ''} ${!editable && settings.timeLimitMin !== m ? 'opacity-50' : ''}`}
              >
                {m === 0 ? 'Aus' : `${m} Min.`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Zurück-Button erlaubt</div>
            <div className="text-sm text-sp-sub">Zum vorherigen Artist springen (zählt als Klick)</div>
          </div>
          <Toggle checked={settings.allowBack} disabled={!editable} onChange={(v) => set({ allowBack: v })} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Gegner live sehen</div>
            <div className="text-sm text-sp-sub">Zeigt, bei welchem Artist die anderen gerade sind</div>
          </div>
          <Toggle checked={settings.showOpponents} disabled={!editable} onChange={(v) => set({ showOpponents: v })} />
        </div>
      </div>
    </div>
  );
}

const MODE_TEXT: Record<GameMode, string> = {
  classic: 'Jeder für sich: alle starten beim selben Artist, wer zuerst am Ziel ist, gewinnt.',
  relay:
    'Zwei Teams, eine Staffel: Läufer 1 rennt vom Start zum Wechselpunkt, dann gibt’s den Stab und Läufer 2 läuft weiter. Die anderen schauen live zu und feuern an. Das schnellere Team gewinnt.',
};

function ModeCard({ settings, editable }: { settings: GameSettings; editable: boolean }) {
  const { send } = useGame();
  const set = (s: Partial<GameSettings>) => {
    sound.play('tap');
    send({ t: 'settings', settings: s });
  };
  const modes: Array<{ id: GameMode; name: string; art: ReactNode }> = [
    { id: 'classic', name: 'Klassisch', art: <Medal place={1} size={34} /> },
    { id: 'relay', name: 'Team-Staffel', art: <Baton size={40} /> },
  ];
  return (
    <div className="rounded-lg bg-sp-card p-5">
      <div className="mb-4 text-xs font-bold uppercase tracking-widest text-sp-sub">Modus</div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modus">
        {modes.map((m) => {
          const on = settings.mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!editable}
              onClick={() => !on && set({ mode: m.id })}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left transition sm:px-4 ${
                on ? 'bg-white/[0.12] ring-2 ring-sp-green-bright' : 'bg-white/[0.04] enabled:hover:bg-white/[0.08]'
              } ${!editable && !on ? 'opacity-50' : ''}`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center">{m.art}</span>
              <span className="font-bold">{m.name}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-sp-sub">{MODE_TEXT[settings.mode]}</p>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
        <div>
          <div className="font-semibold">Sabotage (Power-ups)</div>
          <div className="text-sm text-sp-sub">Nach jedem 2. Sprung gibt’s eine Item-Kiste</div>
        </div>
        <Toggle checked={settings.sabotage} disabled={!editable} onChange={(v) => set({ sabotage: v })} label="Sabotage" />
      </div>
      {settings.sabotage && (
        <div className="mt-4 grid animate-fade-up grid-cols-3 gap-2 sm:grid-cols-6">
          {ITEM_KINDS.map((k) => (
            <div key={k} className="flex flex-col items-center gap-1 rounded-md bg-white/[0.04] px-1 py-2 text-center" title={ITEM_INFO[k].text}>
              <ItemIcon kind={k} size={40} />
              <div className="text-[11px] font-bold leading-tight">{ITEM_INFO[k].name}</div>
              <div className="hidden text-[10px] leading-tight text-sp-muted sm:block">{ITEM_INFO[k].text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamBoard({ state, isHost }: { state: RoomState; isHost: boolean }) {
  const { send, me } = useGame();
  const teams = state.teams ?? [];
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const spectators = state.players.filter((p) => !p.team);
  const sizes = teams.map((t) => t.members.length);
  const ok = sizes.length === 2 && sizes[0] === sizes[1] && sizes[0] >= 2 && sizes[0] <= 3;
  const join = (team: TeamId | null) => {
    sound.play('pick');
    send({ t: 'setTeam', team });
  };
  return (
    <div className="rounded-lg bg-sp-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-widest text-sp-sub">Teams</div>
        {isHost && (
          <button type="button" className="chip flex items-center gap-1.5" onClick={() => (sound.play('tap'), send({ t: 'shuffleTeams' }))}>
            <ShuffleIcon size={15} /> Teams mischen
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {TEAM_IDS.map((id) => {
          const team = teams.find((t) => t.id === id);
          const members = (team?.members ?? []).map((m) => byId.get(m)).filter(Boolean);
          const mine = me?.team === id;
          const full = members.length >= 3;
          return (
            <div
              key={id}
              className="flex flex-col rounded-lg p-3 sm:p-4"
              style={{ background: `linear-gradient(180deg, ${TEAM_COLORS[id]}33, ${TEAM_COLORS[id]}0d 70%)`, boxShadow: mine ? `inset 0 0 0 2px ${TEAM_COLORS[id]}` : undefined }}
            >
              <div className="flex items-center gap-2 sm:gap-2.5">
                <TeamCrest team={id} size={40} className="shrink-0 sm:hidden" />
                <TeamCrest team={id} size={52} className="hidden shrink-0 sm:block" />
                <div className="min-w-0">
                  <div className="text-sm font-extrabold leading-tight sm:text-base">{TEAM_NAMES[id]}</div>
                  <div className="text-xs text-sp-sub">{members.length} / 3</div>
                </div>
              </div>
              <ol className="mt-3 flex-1 space-y-1.5">
                {members.map((p, i) => (
                  <li key={p!.id} className="flex items-center gap-2 rounded-md bg-black/25 px-1.5 py-1.5 sm:px-2" title={`Läufer ${i + 1}`}>
                    <span className="w-3 shrink-0 text-center text-xs font-black tabular-nums text-sp-muted">{i + 1}</span>
                    <PlayerAvatar name={p!.name} color={p!.color} size={26} dim={!p!.connected} />
                    <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${p!.id === me?.id ? 'text-sp-green-bright' : ''}`}>{p!.name}</span>
                    {p!.isHost && <CrownIcon size={12} className="shrink-0 text-[#ffc864]" />}
                    <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-sp-muted xl:inline">Läufer {i + 1}</span>
                  </li>
                ))}
                {members.length === 0 && <li className="px-1 text-sm text-sp-muted">Noch niemand</li>}
              </ol>
              <button
                type="button"
                disabled={mine || full}
                onClick={() => join(id)}
                className="mt-3 rounded-full px-3 py-2 text-sm font-bold text-black transition enabled:hover:scale-[1.03] disabled:opacity-40"
                style={{ background: TEAM_COLORS[id] }}
              >
                {mine ? 'Dein Team' : full ? 'Voll' : 'Beitreten'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="min-w-0 text-sp-sub">
          {spectators.length > 0 ? (
            <>Zuschauer: {spectators.map((p) => p.name).join(', ')}</>
          ) : ok ? (
            'Die Nummer im Team ist die Laufreihenfolge.'
          ) : (
            'Beide Teams brauchen gleich viele Spieler (2 oder 3).'
          )}
        </div>
        {me?.team && (
          <button type="button" className="text-sm font-semibold text-sp-sub underline-offset-2 hover:text-white hover:underline" onClick={() => join(null)}>
            Nur zuschauen
          </button>
        )}
      </div>
    </div>
  );
}

export function Lobby({ state }: { state: RoomState }) {
  const { send, me, toast } = useGame();
  const config = useConfig(20_000);

  // Start-Artist schon in der Lobby laden → beim Countdown ist alles da
  const startId = state.start?.id;
  useEffect(() => {
    if (startId) api.artistPage(startId).catch(() => {});
  }, [startId]);
  const isHost = !!me?.isHost;
  const others = state.players.filter((p) => !p.isHost && p.connected);
  const notReady = others.filter((p) => !p.ready);
  const relay = state.settings.mode === 'relay';
  const size = teamSize(state);
  const sizes = (state.teams ?? []).map((t) => t.members.length);
  const teamsOk = !relay || (sizes.length === 2 && sizes[0] === sizes[1] && sizes[0] >= 2 && sizes[0] <= 3);
  const checkpoints = relay ? state.checkpoints.slice(0, size - 1) : [];
  const routeOk = !!state.start && !!state.target && checkpoints.every(Boolean);
  const canStart = isHost && routeOk && teamsOk && notReady.length === 0;

  const inviteLink = `${location.origin}/?room=${state.code}`;

  let startHint = '';
  if (!routeOk) startHint = relay ? 'Wähle Start, Wechselpunkt' + (size > 2 ? 'e' : '') + ' und Ziel' : 'Wähle Start- und Ziel-Artist';
  else if (!teamsOk) startHint = 'Für die Staffel: zwei gleich große Teams (2 gegen 2 oder 3 gegen 3)';
  else if (notReady.length > 0) startHint = `Warte auf: ${notReady.map((p) => p.name).join(', ')}`;
  else startHint = others.length === 0 ? 'Du kannst auch alleine üben' : 'Alle sind bereit!';
  const allIds = [state.start?.id, state.target?.id, ...checkpoints.map((c) => c?.id)];
  const letters = ['A', 'B', 'C', 'D'];

  return (
    <AppShell state={state}>
      <div className="bg-gradient-to-b from-[#1d6b3a] via-[#123d23] to-sp-base px-5 pb-8 pt-10 sm:px-8">
        <div className="text-sm font-bold">Lobby · Runde {state.round}</div>
        <h1 className="mt-2 text-5xl font-black tracking-tight sm:text-7xl">Spotirace</h1>
        <p className="mt-3 max-w-xl text-sp-sub">
          {relay
            ? 'Team-Staffel: Lauft als Team über gemeinsame Songs vom Start über die Wechselpunkte zum Ziel.'
            : 'Alle starten beim selben Artist. Klickt euch nur über gemeinsame Songs zum Ziel-Artist – wer zuerst ankommt, gewinnt.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-black/30 px-5 py-2.5 text-2xl font-black tracking-[0.35em]">{state.code}</div>
          <button
            type="button"
            className="btn-outline"
            onClick={async () => {
              const ok = await copyText(inviteLink);
              toast(ok ? 'Einladungslink kopiert – schick ihn deinen Freunden!' : inviteLink, ok ? 'success' : 'info');
            }}
          >
            <CopyIcon size={16} /> Einladungslink kopieren
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 pb-10 sm:px-8">
        <ModeCard settings={state.settings} editable={isHost} />

        {relay && <TeamBoard state={state} isHost={isHost} />}

        <div className={`grid gap-4 ${relay ? 'lg:grid-cols-2' : 'xl:grid-cols-2'}`}>
          <ArtistPicker
            label="Start"
            hint={relay ? 'Hier starten die ersten Läufer' : "Hier geht's für alle los"}
            value={state.start}
            editable={isHost}
            excludeIds={allIds}
            accent="green"
            badge={relay ? 'A' : undefined}
            onChange={(artist) => send({ t: 'setArtist', which: 'start', artist })}
          />
          {checkpoints.map((cp, i) => (
            <ArtistPicker
              key={`cp${i}`}
              label={size > 2 ? `Wechselpunkt ${i + 1}` : 'Wechselpunkt'}
              hint={`Hier übergibt Läufer ${i + 1} den Stab an Läufer ${i + 2}`}
              value={cp}
              editable={isHost}
              excludeIds={allIds}
              accent="gold"
              badge={letters[i + 1]}
              onChange={(artist) => send({ t: 'setArtist', which: 'checkpoint', index: i, artist })}
            />
          ))}
          <ArtistPicker
            label="Ziel"
            hint={relay ? 'Das Team, das hier zuerst ankommt, gewinnt' : 'Wer hier zuerst ankommt, gewinnt'}
            value={state.target}
            editable={isHost}
            excludeIds={allIds}
            accent="pink"
            badge={relay ? letters[size] : undefined}
            onChange={(artist) => send({ t: 'setArtist', which: 'target', artist })}
          />
        </div>

        <SettingsCard settings={state.settings} editable={isHost} />

        {config?.usage && (
          <UsageCard usage={config.usage} players={state.players.filter((p) => p.connected).length} cooldownSeconds={config.cooldownSeconds} />
        )}

        <div className="sticky bottom-0 -mx-5 flex flex-col items-center gap-3 bg-gradient-to-t from-sp-base via-sp-base to-transparent px-5 pb-4 pt-8 sm:-mx-8">
          {isHost ? (
            <>
              <button type="button" className="btn-green px-12 py-4 text-lg" disabled={!canStart} onClick={() => send({ t: 'start' })}>
                <PlayIcon size={20} /> Spiel starten
              </button>
              <div className="text-sm text-sp-sub">{startHint}</div>
            </>
          ) : (
            <>
              <button
                type="button"
                className={me?.ready ? 'btn-outline border-sp-green px-12 py-4 text-lg text-sp-green-bright' : 'btn-green px-12 py-4 text-lg'}
                onClick={() => {
                  sound.play(me?.ready ? 'tap' : 'ready');
                  send({ t: 'ready', ready: !me?.ready });
                }}
              >
                {me?.ready ? (
                  <>
                    <CheckIcon size={20} /> Bereit
                  </>
                ) : (
                  <>
                    Ich bin bereit <ArrowRightIcon size={18} />
                  </>
                )}
              </button>
              <div className="text-sm text-sp-sub">
                {me?.ready ? 'Warte auf den Host …' : 'Der Host wählt die Artists und startet das Spiel'}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
