import { useEffect, useRef, useState } from 'react';
import { LogoMark } from './components/Logo';
import { Toasts } from './components/Toasts';
import { api } from './lib/api';
import { GameContext, useGameConnection } from './lib/useGame';
import { Game } from './views/Game';
import { Home } from './views/Home';
import { Lobby } from './views/Lobby';
import { Results } from './views/Results';

export function App() {
  const game = useGameConnection();
  const { state, inRoom, connection, toasts } = game;
  const [demo, setDemo] = useState(false);
  const wasInRoom = useRef(false);

  useEffect(() => {
    api.config().then((c) => setDemo(c.demo)).catch(() => {});
  }, []);

  // URL mit dem Lobby-Code synchron halten (Reload + Teilen funktionieren)
  useEffect(() => {
    if (state?.code) {
      wasInRoom.current = true;
      const want = `/?room=${state.code}`;
      if (location.pathname + location.search !== want) history.replaceState(history.state, '', want);
    } else if (inRoom === false && wasInRoom.current) {
      wasInRoom.current = false;
      history.replaceState(null, '', '/');
    }
  }, [state?.code, inRoom]);

  let content;
  if (inRoom === null || (inRoom && !state)) {
    content = (
      <div className="grid h-dvh place-items-center bg-black">
        <div className="flex flex-col items-center gap-4 text-sp-sub">
          <div className="animate-pulse">
            <LogoMark size={56} />
          </div>
          {connection === 'reconnecting' ? 'Server nicht erreichbar – versuche es weiter …' : 'Verbinde …'}
        </div>
      </div>
    );
  } else if (!state) {
    content = <Home />;
  } else if (state.phase === 'lobby') {
    content = <Lobby state={state} />;
  } else if (state.phase === 'results') {
    content = <Results state={state} />;
  } else {
    content = <Game state={state} demo={demo} />;
  }

  const inGame = state?.phase === 'playing' || state?.phase === 'countdown';

  return (
    <GameContext.Provider value={game}>
      {content}
      {connection === 'reconnecting' && inRoom !== null && (
        <div className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-[#e91429] px-4 py-2 text-sm font-bold shadow-xl">
          Verbindung verloren – verbinde neu …
        </div>
      )}
      <Toasts toasts={toasts} raised={inGame} />
    </GameContext.Provider>
  );
}
