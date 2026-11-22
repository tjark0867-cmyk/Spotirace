import { useEffect, useState } from 'react';
import { sound } from '../lib/sound';
import { MuteIcon, SpeakerIcon } from './Icons';

export function SoundToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(sound.enabled);
  useEffect(() => {
    const off = sound.subscribe(setOn);
    return () => {
      off();
    };
  }, []);
  return (
    <button
      type="button"
      onClick={() => sound.setEnabled(!on)}
      className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-white/10 ${on ? 'text-white' : 'text-sp-muted'} ${className}`}
      title={on ? 'Ton aus' : 'Ton an'}
      aria-label={on ? 'Ton aus' : 'Ton an'}
    >
      {on ? <SpeakerIcon size={18} /> : <MuteIcon size={18} />}
    </button>
  );
}
