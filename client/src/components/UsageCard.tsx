import type { UsageInfo } from '../../../shared/types';

const fmt = (n: number) => n.toLocaleString('de-DE');

/** Zeigt, wie viel vom Spotify-Tageskontingent schon verbraucht ist und wie viele Runden ungefähr noch gehen */
export function UsageCard({ usage, players, cooldownSeconds }: { usage: UsageInfo; players: number; cooldownSeconds: number }) {
  const perRound = usage.perPlayerRound !== null ? Math.max(1, usage.perPlayerRound * Math.max(1, players)) : null;
  const limit = usage.lastLimit?.count ?? null;
  const left = limit !== null ? Math.max(0, limit - usage.today) : null;
  const rounds = left !== null && perRound !== null ? Math.floor(left / perRound) : null;
  const ratio = limit ? Math.min(1, usage.today / limit) : null;
  const blocked = cooldownSeconds > 0;

  return (
    <div className="rounded-lg bg-sp-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-widest text-sp-sub">Spotify-Kontingent · 24 Std.</div>
        <div className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums">{fmt(usage.today)} Anfragen</div>
      </div>

      {ratio !== null && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className={`h-full rounded-full ${ratio > 0.85 ? 'bg-sp-red' : ratio > 0.6 ? 'bg-[#ffc864]' : 'bg-sp-green'}`}
            style={{ width: `${Math.max(2, ratio * 100)}%` }}
          />
        </div>
      )}

      <div className="space-y-1.5 text-sm text-sp-sub">
        {blocked ? (
          <p className="font-semibold text-[#ffc864]">Spotify macht gerade Pause – neue Runden laufen solange mit Deezer-Daten.</p>
        ) : rounds !== null ? (
          <p>
            Gerade gehen noch ungefähr <b className="text-white">{rounds === 0 ? 'keine' : rounds} {rounds === 1 ? 'Runde' : 'Runden'}</b> mit {players}{' '}
            {players === 1 ? 'Spieler' : 'Spielern'}.
          </p>
        ) : null}
        {perRound !== null ? (
          <p>
            Eine Runde mit {players} {players === 1 ? 'Spieler' : 'Spielern'} kostet etwa <b className="text-white">{fmt(Math.round(perRound))}</b> Anfragen
            (gemessen).
          </p>
        ) : (
          <p>Nach der ersten Runde steht hier, wie viele Anfragen eine Runde kostet.</p>
        )}
        {limit !== null ? (
          <p>Zuletzt war bei ca. {fmt(limit)} Anfragen Schluss.</p>
        ) : (
          <p>Wo Spotifys Limit genau liegt, sehen wir, sobald es einmal erreicht wurde.</p>
        )}
        {!usage.persistent && <p className="text-xs text-sp-muted">Ohne Zwischenspeicher fängt der Zähler nach jedem Server-Neustart bei 0 an.</p>}
      </div>
    </div>
  );
}
