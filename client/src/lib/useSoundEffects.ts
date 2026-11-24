import { useEffect, useRef } from 'react';
import type { RoomState } from '../../../shared/types';
import { sound } from './sound';

/** Spielt Sounds passend zu Änderungen im Spielstand (Beitritt, Sprung, Sieg, Ergebnis …) */
export function useSoundEffects(state: RoomState | null) {
  const prev = useRef<RoomState | null>(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (!state || !p || p.code !== state.code) return;

    const me = state.players.find((x) => x.id === state.you);
    const meBefore = p.players.find((x) => x.id === p.you);
    const before = new Map(p.players.map((x) => [x.id, x]));

    // Eigener Sieg hat Vorrang vor allem anderen
    if (me?.status === 'finished' && meBefore?.status !== 'finished') {
      sound.play('win');
      return;
    }
    if (p.phase !== 'results' && state.phase === 'results') {
      sound.play('results');
      return;
    }

    if (state.phase === 'lobby') {
      const joined = state.players.some((x) => x.id !== state.you && !before.has(x.id));
      const left = p.players.some((x) => !state.players.some((y) => y.id === x.id));
      const otherReady = state.players.some((x) => x.id !== state.you && x.ready && before.get(x.id)?.ready === false);
      if (joined) sound.play('join');
      else if (left) sound.play('leave');
      else if (otherReady) sound.play('tap');
      return;
    }

    if (state.phase === 'playing') {
      if (state.round === p.round && p.yourPath.length > 0 && state.yourPath.length > p.yourPath.length) {
        const last = state.yourPath[state.yourPath.length - 1];
        // Rückspulen durch einen Gegner hat einen eigenen Sound (kommt als Effekt-Ereignis)
        if (!last.rewind) sound.play(last.back ? 'back' : 'jump');
      } else if (me && meBefore && me.status !== meBefore.status && (me.status === 'gaveup' || me.status === 'timeout')) {
        sound.play('lose');
      }
      const otherFinished = state.players.some(
        (x) => x.id !== state.you && x.status === 'finished' && before.get(x.id)?.status !== 'finished',
      );
      if (otherFinished) sound.play('opponentFinished');
    }
  }, [state]);
}
