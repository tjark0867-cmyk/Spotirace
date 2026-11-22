import { useState, type ReactNode, type RefObject } from 'react';
import type { RoomState } from '../../../shared/types';
import { copyText, useGame } from '../lib/useGame';
import { CloseIcon, CopyIcon, ExitIcon, UsersIcon } from './Icons';
import { Logo } from './Logo';
import { PlayersPanel } from './PlayersPanel';
import { SoundToggle } from './SoundToggle';

function RoomCode({ code }: { code: string }) {
  const { toast } = useGame();
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(`${location.origin}/?room=${code}`);
        toast(ok ? 'Einladungslink kopiert' : `Code: ${code}`, ok ? 'success' : 'info');
      }}
      className="group flex items-center gap-2 rounded-full bg-white/[0.07] py-1 pl-3 pr-2.5 text-sm font-bold tracking-[0.2em] text-white transition hover:bg-white/[0.12]"
      title="Einladungslink kopieren"
    >
      {code}
      <CopyIcon size={15} className="text-sp-sub group-hover:text-white" />
    </button>
  );
}

export function AppShell({
  state,
  children,
  bottomBar,
  mainRef,
}: {
  state: RoomState;
  children: ReactNode;
  bottomBar?: ReactNode;
  mainRef?: RefObject<HTMLElement | null>;
}) {
  const { send } = useGame();
  const [drawer, setDrawer] = useState(false);

  const leave = () => {
    const playing = state.phase === 'playing' || state.phase === 'countdown';
    if (playing && !window.confirm('Runde wirklich verlassen?')) return;
    send({ t: 'leave' });
  };

  return (
    <div className="flex h-dvh flex-col gap-2 bg-black p-2">
      {/* Kopfzeile für Handys */}
      <div className="flex items-center justify-between gap-2 rounded-lg bg-sp-base px-3 py-2 lg:hidden">
        <Logo size={26} />
        <div className="flex items-center gap-1.5">
          <SoundToggle />
          <RoomCode code={state.code} />
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-white"
            title="Spieler"
          >
            <UsersIcon size={18} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        <aside className="hidden w-[300px] shrink-0 flex-col gap-2 lg:flex">
          <div className="flex items-center justify-between rounded-lg bg-sp-base px-5 py-4">
            <Logo size={30} />
            <div className="flex items-center gap-1">
            <SoundToggle />
            <button
              type="button"
              onClick={leave}
              className="grid h-8 w-8 place-items-center rounded-full text-sp-sub transition hover:bg-white/10 hover:text-white"
              title="Lobby verlassen"
            >
              <ExitIcon size={18} />
            </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-sp-base pt-3">
            <div className="flex items-center justify-between px-4 pb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-sp-muted">Lobby-Code</span>
              <RoomCode code={state.code} />
            </div>
            <PlayersPanel state={state} />
          </div>
        </aside>

        <main ref={mainRef} className="sp-scroll relative min-w-0 flex-1 overflow-y-auto rounded-lg bg-sp-base">
          {children}
        </main>
      </div>

      {bottomBar}

      {drawer && (
        <div className="fixed inset-0 z-40 flex lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative ml-auto flex h-full w-[86vw] max-w-sm animate-fade-up flex-col bg-sp-base pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pb-3">
              <Logo size={26} />
              <button type="button" onClick={() => setDrawer(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
                <CloseIcon size={18} />
              </button>
            </div>
            <PlayersPanel state={state} />
            <div className="p-4">
              <button type="button" onClick={leave} className="btn-outline w-full">
                <ExitIcon size={16} /> Lobby verlassen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
