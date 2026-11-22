import { useEffect, useRef, useState } from 'react';
import type { ArtistSummary } from '../../../shared/types';
import { api } from '../lib/api';
import { useGame } from '../lib/useGame';
import { CloseIcon, SearchIcon, ShuffleIcon } from './Icons';
import { ArtistImage } from './Media';

interface Props {
  label: string;
  hint: string;
  value: ArtistSummary | null;
  editable: boolean;
  excludeId?: string | null;
  onChange: (artist: ArtistSummary | null) => void;
  accent: 'green' | 'pink';
}

export function ArtistPicker({ label, hint, value, editable, excludeId, onChange, accent }: Props) {
  const { toast } = useGame();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Suche mit Verzögerung, damit nicht jeder Tastendruck eine Anfrage auslöst
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .search(q)
        .then((r) => !cancelled && setResults(r))
        .catch((e: Error) => !cancelled && toast(e.message, 'error'))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, toast]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (artist: ArtistSummary) => {
    if (excludeId && artist.id === excludeId) {
      toast('Start und Ziel müssen verschiedene Artists sein', 'error');
      return;
    }
    onChange(artist);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const random = async () => {
    setRandomLoading(true);
    try {
      const exclude = [excludeId, value?.id].filter(Boolean) as string[];
      pick(await api.randomArtist(exclude));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setRandomLoading(false);
    }
  };

  const accentText = accent === 'green' ? 'text-sp-green-bright' : 'text-[#f573a0]';
  const accentRing = accent === 'green' ? 'ring-sp-green/60' : 'ring-[#f573a0]/60';

  return (
    <div className="rounded-lg bg-sp-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className={`text-xs font-bold uppercase tracking-widest ${accentText}`}>{label}</div>
          <div className="text-sm text-sp-sub">{hint}</div>
        </div>
        {editable && (
          <button
            type="button"
            onClick={random}
            disabled={randomLoading}
            className="chip flex items-center gap-1.5"
            title="Zufälligen Artist wählen"
          >
            <ShuffleIcon size={15} /> {randomLoading ? '…' : 'Zufällig'}
          </button>
        )}
      </div>

      {value ? (
        <div className="flex items-center gap-4 animate-fade-up">
          <ArtistImage artist={value} size={88} className={`shadow-xl ring-2 ${accentRing}`} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-extrabold tracking-tight">{value.name}</div>
            {value.genres.length > 0 && <div className="truncate text-sm text-sp-sub">{value.genres.slice(0, 3).join(' · ')}</div>}
          </div>
          {editable && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sp-sub transition hover:bg-white/10 hover:text-white"
              title="Entfernen"
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>
      ) : editable ? null : (
        <div className="flex h-[88px] items-center gap-4 text-sp-muted">
          <div className="h-[88px] w-[88px] rounded-full skeleton" />
          <span>Der Host wählt noch …</span>
        </div>
      )}

      {editable && (
        <div ref={boxRef} className={`relative ${value ? 'mt-4' : ''}`}>
          <div className="relative">
            <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sp-sub" />
            <input
              className="sp-input rounded-full pl-11"
              placeholder={value ? 'Anderen Artist suchen …' : 'Artist suchen …'}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) pick(results[0]);
                if (e.key === 'Escape') setOpen(false);
              }}
            />
          </div>
          {open && query.trim().length >= 2 && (
            <div className="sp-scroll absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-md bg-sp-elevated p-1 shadow-[0_16px_24px_rgba(0,0,0,.5)]">
              {loading && results.length === 0 && <div className="px-3 py-3 text-sm text-sp-sub">Suche …</div>}
              {!loading && results.length === 0 && <div className="px-3 py-3 text-sm text-sp-sub">Keine Artists gefunden</div>}
              {results.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pick(a)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left transition hover:bg-white/10"
                >
                  <ArtistImage artist={a} size={44} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{a.name}</div>
                    <div className="truncate text-xs text-sp-sub">Künstler:in{a.genres[0] ? ` · ${a.genres[0]}` : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
