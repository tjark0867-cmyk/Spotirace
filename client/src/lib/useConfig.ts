import { useEffect, useState } from 'react';
import type { AppConfig } from '../../../shared/types';
import { api } from './api';

/** Server-Konfiguration inkl. Spotify-Verbrauch, regelmäßig aktualisiert */
export function useConfig(pollMs = 20_000): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .configFresh()
        .then((c) => !cancelled && setConfig(c))
        .catch(() => {});
    load();
    const id = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);
  return config;
}
