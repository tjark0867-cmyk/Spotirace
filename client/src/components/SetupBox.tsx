import type { SetupStatus } from '../../../shared/types';
import { copyText, useGame } from '../lib/useGame';
import { CheckIcon, CloseIcon, CopyIcon } from './Icons';

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sp-green text-black">
      <CheckIcon size={14} />
    </span>
  ) : (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sp-red text-black">
      <CloseIcon size={14} />
    </span>
  );
}

/** Zeigt genau, was bei Render (bzw. in der .env) eingetragen werden muss und was noch fehlt. */
export function SetupBox({ setup }: { setup: SetupStatus }) {
  const { toast } = useGame();
  const keysOk = setup.idFound && setup.secretFound;
  const rows = [
    { key: 'SPOTIFY_CLIENT_ID', value: 'Client ID von Spotify', ok: setup.idFound },
    { key: 'SPOTIFY_CLIENT_SECRET', value: 'Client Secret von Spotify', ok: setup.secretFound },
  ];
  return (
    <div className="mt-6 w-full rounded-xl border border-sp-red/40 bg-[#2a1215] p-5 text-sm text-white">
      <div className="text-base font-extrabold">Spotify ist noch nicht verbunden</div>
      <p className="mt-1 text-[#ffc2c8]">
        So muss es bei <b>Render → spotirace → Environment</b> aussehen:
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_24px] gap-3 bg-white/[0.06] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-sp-sub">
          <span>Key (links)</span>
          <span>Value (rechts)</span>
          <span />
        </div>
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[auto_minmax(0,1fr)_24px] items-center gap-3 border-t border-white/10 px-3 py-3">
            <button
              type="button"
              title="Namen kopieren"
              onClick={async () => toast((await copyText(r.key)) ? `${r.key} kopiert` : r.key, 'success')}
              className="flex items-center gap-1.5 whitespace-nowrap rounded font-mono text-[12.5px] font-bold text-white underline decoration-white/30 underline-offset-4"
            >
              {r.key}
              <CopyIcon size={13} className="text-sp-sub" />
            </button>
            <span className="text-sp-sub">{r.value}</span>
            <Mark ok={r.ok} />
          </div>
        ))}
      </div>

      {keysOk && (
        <div className="mt-4 flex items-start gap-3">
          <Mark ok={setup.login === 'ok'} />
          <div>
            <div className="font-bold">{setup.login === 'unknown' ? 'Login bei Spotify wird getestet …' : 'Login bei Spotify'}</div>
            {setup.loginError && <div className="text-[#ffc2c8]">{setup.loginError}</div>}
          </div>
        </div>
      )}

      {setup.hints.length > 0 && (
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[#ffc2c8]">
          {setup.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-sp-sub">
        Tipp: Tippe auf einen Namen, um ihn zu kopieren, und füge ihn bei Render links bei „Key“ ein. Danach <b className="text-white">„Save, rebuild, and deploy“</b> tippen, 2–3 Minuten
        warten und diese Seite neu laden.
      </p>
    </div>
  );
}
