import type { GameSettings, RoomState, TimeLimit } from '../../../shared/types';
import { AppShell } from '../components/AppShell';
import { ArtistPicker } from '../components/ArtistPicker';
import { ArrowRightIcon, CheckIcon, CopyIcon, PlayIcon } from '../components/Icons';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { sound } from '../lib/sound';
import { copyText, useGame } from '../lib/useGame';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="switch"
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

export function Lobby({ state }: { state: RoomState }) {
  const { send, me, toast } = useGame();

  // Start-Artist schon in der Lobby laden → beim Countdown ist alles da
  const startId = state.start?.id;
  useEffect(() => {
    if (startId) api.artistPage(startId).catch(() => {});
  }, [startId]);
  const isHost = !!me?.isHost;
  const others = state.players.filter((p) => !p.isHost && p.connected);
  const notReady = others.filter((p) => !p.ready);
  const canStart = isHost && !!state.start && !!state.target && notReady.length === 0;

  const inviteLink = `${location.origin}/?room=${state.code}`;

  let startHint = '';
  if (!state.start || !state.target) startHint = 'Wähle Start- und Ziel-Artist';
  else if (notReady.length > 0) startHint = `Warte auf: ${notReady.map((p) => p.name).join(', ')}`;
  else startHint = others.length === 0 ? 'Du kannst auch alleine üben' : 'Alle sind bereit!';

  return (
    <AppShell state={state}>
      <div className="bg-gradient-to-b from-[#1d6b3a] via-[#123d23] to-sp-base px-5 pb-8 pt-10 sm:px-8">
        <div className="text-sm font-bold">Lobby · Runde {state.round}</div>
        <h1 className="mt-2 text-5xl font-black tracking-tight sm:text-7xl">Spotirace</h1>
        <p className="mt-3 max-w-xl text-sp-sub">
          Alle starten beim selben Artist. Klickt euch nur über gemeinsame Songs zum Ziel-Artist – wer zuerst ankommt, gewinnt.
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
        <div className="grid gap-4 xl:grid-cols-2">
          <ArtistPicker
            label="Start"
            hint="Hier geht's für alle los"
            value={state.start}
            editable={isHost}
            excludeId={state.target?.id}
            accent="green"
            onChange={(artist) => send({ t: 'setArtist', which: 'start', artist })}
          />
          <ArtistPicker
            label="Ziel"
            hint="Wer hier zuerst ankommt, gewinnt"
            value={state.target}
            editable={isHost}
            excludeId={state.start?.id}
            accent="pink"
            onChange={(artist) => send({ t: 'setArtist', which: 'target', artist })}
          />
        </div>

        <SettingsCard settings={state.settings} editable={isHost} />

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
