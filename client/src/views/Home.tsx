import { useEffect, useState } from 'react';
import { ArrowRightIcon, FlagIcon, MouseClickIcon, UsersIcon } from '../components/Icons';
import { Logo } from '../components/Logo';
import type { SetupStatus } from '../../../shared/types';
import { SetupBox } from '../components/SetupBox';
import { SoundToggle } from '../components/SoundToggle';
import { api } from '../lib/api';
import { sound } from '../lib/sound';
import { useGame } from '../lib/useGame';

const NAME_KEY = 'spotirace.name';

export function Home() {
  const { send, connection } = useGame();
  const invited = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [code, setCode] = useState(invited);
  const [demo, setDemo] = useState(false);
  const [missingKeys, setMissingKeys] = useState(false);
  const [setup, setSetup] = useState<SetupStatus | null>(null);

  useEffect(() => {
    api
      .config()
      .then((c) => {
        setDemo(c.demo);
        setMissingKeys(c.missingKeys);
        setSetup(c.setup);
      })
      .catch(() => {});
  }, []);

  // Solange Spotify nicht verbunden ist, regelmäßig nachsehen – nach dem Deploy verschwindet der Hinweis von selbst
  useEffect(() => {
    if (!missingKeys) return;
    const id = setInterval(() => {
      api
        .configFresh()
        .then((c) => {
          setMissingKeys(c.missingKeys);
          setSetup(c.setup);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [missingKeys]);

  const saveName = () => {
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      /* egal */
    }
  };

  const create = () => {
    sound.play('tap');
    saveName();
    send({ t: 'create', name });
  };
  const join = () => {
    if (!code.trim()) return;
    sound.play('tap');
    saveName();
    send({ t: 'join', code: code.trim().toUpperCase(), name });
  };

  const nameOk = name.trim().length > 0;
  const online = connection === 'open';

  return (
    <div className="relative min-h-dvh bg-[radial-gradient(ellipse_at_top,#1f6b3b_0%,#0f2a19_35%,#000_75%)] px-4 py-10 sm:py-16">
      <SoundToggle className="absolute right-3 top-3" />
      <div className="mx-auto flex max-w-[440px] flex-col items-center">
        <Logo size={52} />
        <p className="mt-4 text-center text-lg text-sp-sub">
          Das Wettrennen durch die Musikwelt.
          <br />
          Vom Start-Artist zum Ziel – nur über gemeinsame Songs.
        </p>

        {missingKeys && setup && <SetupBox setup={setup} />}

        {demo && (
          <div className="mt-6 w-full rounded-lg border border-[#ffc864]/30 bg-[#ffc864]/10 px-4 py-3 text-sm text-[#ffe2a8]">
            <b>Demo-Modus (DEMO=1):</b> Es werden erfundene Artists verwendet. Entferne DEMO=1, um mit echten Spotify-Daten zu spielen.
          </div>
        )}

        <div className="mt-8 w-full rounded-xl bg-sp-base/90 p-6 shadow-2xl backdrop-blur sm:p-8">
          {invited && (
            <div className="mb-5 rounded-md bg-sp-green/15 px-4 py-3 text-sm font-semibold text-sp-green-bright">
              Du wurdest in die Lobby {invited} eingeladen 🎉
            </div>
          )}
          <label className="mb-2 block text-sm font-bold" htmlFor="name">
            Dein Name
          </label>
          <input
            id="name"
            className="sp-input"
            placeholder="z. B. Alex"
            maxLength={20}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && nameOk && (invited ? join() : create())}
          />

          {!invited && (
            <button type="button" className="btn-green mt-6 w-full" disabled={!nameOk || !online || missingKeys} onClick={create}>
              Lobby erstellen
            </button>
          )}

          {!invited && (
            <div className="my-6 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-sp-muted">
              <div className="h-px flex-1 bg-sp-border" /> oder <div className="h-px flex-1 bg-sp-border" />
            </div>
          )}

          <label className={`mb-2 block text-sm font-bold ${invited ? 'mt-5' : ''}`} htmlFor="code">
            Lobby-Code
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              className="sp-input uppercase tracking-[0.3em]"
              placeholder="ABC123"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && nameOk && join()}
            />
            <button
              type="button"
              className={invited ? 'btn-green shrink-0 px-6' : 'btn-outline shrink-0'}
              disabled={!nameOk || code.trim().length < 4 || !online || missingKeys}
              onClick={join}
            >
              Beitreten <ArrowRightIcon size={16} />
            </button>
          </div>
          {invited && (
            <button
              type="button"
              className="mt-5 text-sm text-sp-sub underline-offset-4 hover:text-white hover:underline"
              onClick={() => {
                history.replaceState(null, '', '/');
                setCode('');
                location.reload();
              }}
            >
              Lieber eine eigene Lobby erstellen
            </button>
          )}
          {!online && <p className="mt-4 text-center text-sm text-sp-muted">Verbinde mit dem Server …</p>}
        </div>

        <div className="mt-10 grid w-full gap-3 sm:grid-cols-3">
          {[
            { icon: <UsersIcon size={22} />, title: 'Lobby', text: 'Freunde per Link einladen' },
            { icon: <MouseClickIcon size={22} />, title: 'Klicken', text: 'Über Features zum nächsten Artist' },
            { icon: <FlagIcon size={22} />, title: 'Ziel', text: 'Wer zuerst ankommt, gewinnt' },
          ].map((s) => (
            <div key={s.title} className="rounded-lg bg-white/[0.04] p-4 text-center">
              <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-sp-green/15 text-sp-green-bright">{s.icon}</div>
              <div className="font-bold">{s.title}</div>
              <div className="text-sm text-sp-sub">{s.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
