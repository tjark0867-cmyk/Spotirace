import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PopularArtist, SetupStatus } from '../../../shared/types';
import { ArrowRightIcon, FlagIcon, MouseClickIcon, MusicNoteIcon, UsersIcon } from '../components/Icons';
import { Logo } from '../components/Logo';
import { SetupBox } from '../components/SetupBox';
import { SoundToggle } from '../components/SoundToggle';
import { api } from '../lib/api';
import { sound } from '../lib/sound';
import { useGame } from '../lib/useGame';

const NAME_KEY = 'spotirace.name';

type Mode = 'create' | 'join';

/** Langsam vorbeiziehende Artist-Bilder im Hintergrund (Spotify-Bilder, nur Deko) */
function ArtistMosaic({ artists }: { artists: PopularArtist[] }) {
  const pics = artists.filter((a) => a.image).slice(0, 12);
  if (pics.length < 4) return null;
  const row = [...pics, ...pics]; // doppelt für nahtlose Endlos-Bewegung
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden" aria-hidden>
      <div className="absolute -left-10 top-6 flex w-max animate-drift gap-5 opacity-[0.22] sm:top-10">
        {row.map((a, i) => (
          <img
            key={i}
            src={a.image!}
            alt=""
            loading="lazy"
            decoding="async"
            className={`h-24 w-24 shrink-0 object-cover sm:h-32 sm:w-32 ${i % 3 === 1 ? 'rounded-md' : 'rounded-full'} ${i % 2 ? 'translate-y-10' : ''}`}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />
    </div>
  );
}

/** Kleine Grafik: Start → Song → Feature → Song → Ziel */
function RouteGraphic() {
  const node = (label: string, cls: string, icon: ReactNode) => (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`grid h-12 w-12 place-items-center rounded-full text-black shadow-lg sm:h-14 sm:w-14 ${cls}`}>{icon}</div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-sp-sub">{label}</span>
    </div>
  );
  const song = (
    <div className="mb-5 flex items-center gap-1 text-sp-muted">
      <span className="h-px w-3 bg-sp-muted sm:w-5" />
      <span className="grid h-7 w-7 place-items-center rounded bg-white/10 text-white">
        <MusicNoteIcon size={14} />
      </span>
      <span className="h-px w-3 bg-sp-muted sm:w-5" />
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {node('Start', 'bg-sp-green', <span className="text-lg font-black">A</span>)}
      {song}
      {node('Feature', 'bg-white', <span className="text-lg font-black">B</span>)}
      {song}
      {node('Ziel', 'bg-[#f573a0]', <FlagIcon size={20} />)}
    </div>
  );
}

export function Home() {
  const { send, connection } = useGame();
  const invited = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  const [mode, setMode] = useState<Mode>(invited ? 'join' : 'create');
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
  const [cooldown, setCooldown] = useState(0);
  const [hybrid, setHybrid] = useState(false);
  const [usedToday, setUsedToday] = useState<number | null>(null);
  const [popular, setPopular] = useState<PopularArtist[]>([]);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .config()
      .then((c) => {
        setDemo(c.demo);
        setMissingKeys(c.missingKeys);
        setSetup(c.setup);
        setCooldown(c.cooldownSeconds ?? 0);
        setHybrid(!!c.hybrid);
        setUsedToday(c.usage?.today ?? null);
        // Hintergrundbilder nur, wenn Spotify bereit ist (die Vorschläge sind ohnehin gespeichert)
        if (!c.missingKeys && (c.hybrid || !(c.cooldownSeconds > 0))) api.popular().then(setPopular).catch(() => {});
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
  const canCreate = nameOk && online && !missingKeys;
  const canJoin = nameOk && online && !missingKeys && code.trim().length >= 4;

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    sound.play('tap');
    setMode(m);
    if (m === 'join') setTimeout(() => codeRef.current?.focus(), 50);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-black">
      <ArtistMosaic artists={popular} />
      <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(30,215,96,.35),transparent)]" />
      <SoundToggle className="absolute right-3 top-3 z-10" />

      <div className="relative mx-auto flex max-w-[460px] flex-col items-center px-4 pb-10 pt-12 sm:pt-20">
        <Logo size={44} animated />
        <h1 className="mt-6 text-balance text-center text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">Wer findet den Weg zuerst?</h1>
        <p className="mt-3 text-center text-base text-sp-sub sm:text-lg">Vom Start-Artist zum Ziel – nur über gemeinsame Songs.</p>

        {missingKeys && setup && <SetupBox setup={setup} />}
        {cooldown > 0 && !missingKeys && (
          <div className="mt-6 w-full rounded-lg border border-[#ffc864]/30 bg-[#ffc864]/10 px-4 py-3 text-sm text-[#ffe2a8]">
            <b>Spotify macht gerade Pause für diese App.</b> Das Kontingent ist aufgebraucht und wird in ca.{' '}
            {cooldown >= 3600 ? `${Math.floor(cooldown / 3600)} Std. ${Math.round((cooldown % 3600) / 60)} Min.` : `${Math.max(1, Math.round(cooldown / 60))} Min.`}{' '}
            wieder freigegeben.{' '}
            {hybrid
              ? 'Bis dahin kommen Profilbilder und „Erscheint auf“ von Deezer – spielen könnt ihr trotzdem.'
              : 'Danach läuft alles normal.'}
          </div>
        )}
        {demo && (
          <div className="mt-6 w-full rounded-lg border border-[#ffc864]/30 bg-[#ffc864]/10 px-4 py-3 text-sm text-[#ffe2a8]">
            <b>Demo-Modus (DEMO=1):</b> Es werden erfundene Artists verwendet. Entferne DEMO=1, um mit echten Spotify-Daten zu spielen.
          </div>
        )}

        <div className="mt-8 w-full rounded-2xl border border-white/10 bg-sp-base/85 p-5 shadow-[0_24px_60px_rgba(0,0,0,.6)] backdrop-blur-xl sm:p-7">
          {invited ? (
            <div className="mb-5 flex items-center gap-3 rounded-lg bg-sp-green/15 px-4 py-3 text-sm font-semibold text-sp-green-bright">
              <UsersIcon size={18} /> Du wurdest in die Lobby {invited} eingeladen
            </div>
          ) : (
            <div className="mb-6 grid grid-cols-2 rounded-full bg-white/[0.06] p-1" role="tablist">
              {(['create', 'join'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`rounded-full py-2.5 text-sm font-bold transition ${mode === m ? 'bg-white text-black shadow' : 'text-sp-sub hover:text-white'}`}
                >
                  {m === 'create' ? 'Neue Lobby' : 'Beitreten'}
                </button>
              ))}
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
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              if (mode === 'join') {
                if (canJoin) join();
                else codeRef.current?.focus();
              } else if (canCreate) create();
            }}
          />

          {mode === 'create' ? (
            <button type="button" className="btn-green mt-5 w-full py-3.5 text-lg" disabled={!canCreate} onClick={create}>
              Lobby erstellen
            </button>
          ) : (
            <>
              <label className="mb-2 mt-5 block text-sm font-bold" htmlFor="code">
                Lobby-Code
              </label>
              <input
                ref={codeRef}
                id="code"
                className="sp-input text-center font-mono text-2xl font-black uppercase tracking-[0.45em]"
                placeholder="ABC123"
                maxLength={6}
                value={code}
                autoComplete="off"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && canJoin && join()}
              />
              <button type="button" className="btn-green mt-5 w-full py-3.5 text-lg" disabled={!canJoin} onClick={join}>
                Beitreten <ArrowRightIcon size={18} />
              </button>
              {invited && (
                <button
                  type="button"
                  className="mt-4 w-full text-center text-sm text-sp-sub underline-offset-4 hover:text-white hover:underline"
                  onClick={() => {
                    history.replaceState(null, '', '/');
                    location.reload();
                  }}
                >
                  Lieber eine eigene Lobby erstellen
                </button>
              )}
            </>
          )}
          {!online && <p className="mt-4 text-center text-sm text-sp-muted">Verbinde mit dem Server …</p>}
        </div>

        <div className="mt-10 w-full rounded-2xl bg-white/[0.03] p-5 sm:p-6">
          <div className="mb-5 text-center text-xs font-bold uppercase tracking-widest text-sp-sub">So funktioniert's</div>
          <RouteGraphic />
          <div className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-3">
            {[
              { icon: <UsersIcon size={18} />, title: 'Lobby', text: 'Freunde per Link einladen, Start und Ziel wählen' },
              { icon: <MouseClickIcon size={18} />, title: 'Springen', text: 'Im Album auf einen Feature-Artist tippen' },
              { icon: <FlagIcon size={18} />, title: 'Ziel', text: 'Wer zuerst beim Ziel landet, gewinnt' },
            ].map((s) => (
              <div key={s.title} className="flex items-start gap-3 sm:flex-col sm:items-center sm:text-center">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sp-green/15 text-sp-green-bright">{s.icon}</div>
                <div>
                  <div className="font-bold">{s.title}</div>
                  <div className="text-sm text-sp-sub">{s.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-sp-muted">
          {usedToday !== null && <>Spotify heute: {usedToday.toLocaleString('de-DE')} Anfragen · </>}
          Musikdaten von Deezer · Fanprojekt, nicht mit Spotify verbunden
        </p>
      </div>
    </div>
  );
}
