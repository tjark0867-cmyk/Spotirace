import type { SetupStatus } from '../shared/types';

/**
 * Liest die Spotify-Keys aus den Umgebungsvariablen – möglichst fehlertolerant:
 * Leerzeichen, Anführungszeichen und ähnliche Namen ("Client ID", "client_secret" …)
 * werden akzeptiert. Außerdem entstehen verständliche Hinweise, falls etwas nicht passt.
 * Es werden nie Werte nach außen gegeben, nur Namen und ob etwas gefunden wurde.
 */

const HEX32 = /^[0-9a-f]{32}$/i;
const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, '');
const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface SpotifyKeys {
  clientId: string;
  clientSecret: string;
  status: SetupStatus;
}

export function readSpotifyKeys(env: NodeJS.ProcessEnv = process.env): SpotifyKeys {
  const names = Object.keys(env);

  const pick = (exact: string, matches: (n: string) => boolean): string | null => {
    if (clean(env[exact])) return exact;
    return names.find((n) => n !== exact && matches(norm(n)) && clean(env[n])) ?? null;
  };

  const idName0 = pick('SPOTIFY_CLIENT_ID', (n) => n.includes('clientid') || n === 'spotifyid' || n === 'id');
  let idName = idName0;
  let secretName = pick(
    'SPOTIFY_CLIENT_SECRET',
    (n) => n.includes('clientsecret') || n === 'spotifysecret' || n === 'secret' || n === 'clientsecrect',
  );
  let clientId = idName ? clean(env[idName]) : '';
  let clientSecret = secretName ? clean(env[secretName]) : '';
  const hints: string[] = [];

  // Notfall-Suche: Steht ein Key versehentlich in einem anderen Feld (z. B. NODE_VERSION oder SPOTIFY_MARKET)?
  const isSystem = (n: string) => /^(RENDER|npm_|GIT_|PATH$|HOME$|HOSTNAME$|PWD$|SHLVL$|_$)/i.test(n);
  const hexVars = names.filter((n) => !isSystem(n) && HEX32.test(clean(env[n])));
  const strayValues = (exclude: string) =>
    [...new Set(hexVars.map((n) => clean(env[n])).filter((v) => v !== exclude))];
  if (!clientSecret && clientId) {
    const values = strayValues(clientId);
    if (values.length === 1) {
      clientSecret = values[0];
      secretName = hexVars.find((n) => clean(env[n]) === clientSecret && n !== idName) ?? null;
      hints.push(
        `Das Client Secret steht im Feld „${secretName}“ – es funktioniert so, aber besser einen eigenen Eintrag SPOTIFY_CLIENT_SECRET anlegen und „${secretName}“ wieder richtig setzen.`,
      );
    }
  }
  if (!clientId && clientSecret) {
    const values = strayValues(clientSecret);
    if (values.length === 1) {
      clientId = values[0];
      idName = hexVars.find((n) => clean(env[n]) === clientId && n !== secretName) ?? null;
      hints.push(`Die Client ID steht im Feld „${idName}“ – es funktioniert so, aber besser einen eigenen Eintrag SPOTIFY_CLIENT_ID anlegen.`);
    }
  }
  const nodeVersion = clean(env.NODE_VERSION);
  if (nodeVersion && !/^v?\d+(\.\d+){0,2}$/.test(nodeVersion)) {
    hints.push('NODE_VERSION hat einen falschen Wert. Dort muss einfach 22 stehen (oder den Eintrag löschen).');
  }
  const rawMarket = env.SPOTIFY_MARKET;
  if (rawMarket !== undefined && clean(rawMarket) && !/^[A-Za-z]{2}$/.test(clean(rawMarket))) {
    hints.push('SPOTIFY_MARKET hat einen falschen Wert. Dort muss DE stehen (oder den Eintrag löschen).');
  }

  const codeAsName = names.filter((n) => HEX32.test(n.trim()));
  if (codeAsName.length > 0) {
    hints.push(
      'Bei Render steht ein Code im linken Feld „Key“. Links gehört der NAME hin (SPOTIFY_CLIENT_ID bzw. SPOTIFY_CLIENT_SECRET), rechts bei „Value“ der Code.',
    );
  }
  if (idName && idName !== 'SPOTIFY_CLIENT_ID' && !hints.some((h) => h.includes(`„${idName}“`))) hints.push(`Client ID gefunden unter „${idName}“ – funktioniert, besser wäre der Name SPOTIFY_CLIENT_ID.`);
  if (secretName && secretName !== 'SPOTIFY_CLIENT_SECRET' && !hints.some((h) => h.includes(`„${secretName}“`))) {
    hints.push(`Client Secret gefunden unter „${secretName}“ – funktioniert, besser wäre der Name SPOTIFY_CLIENT_SECRET.`);
  }
  if (clientId && !HEX32.test(clientId)) hints.push('Die Client ID sieht nicht richtig aus: Sie hat 32 Zeichen aus 0–9 und a–f. Am besten mit dem Kopier-Symbol neben der ID kopieren.');
  if (clientSecret && !HEX32.test(clientSecret)) {
    hints.push('Das Client Secret sieht nicht richtig aus: Es hat 32 Zeichen aus 0–9 und a–f. Bei Spotify auf „View client secret“ tippen und den Code mit dem Kopier-Symbol kopieren.');
  }
  if (clientId && clientSecret && clientId === clientSecret) {
    hints.push('Client ID und Client Secret sind gleich. Für das Secret bei Spotify auf „View client secret“ tippen – das ist ein zweiter, anderer Code.');
  }
  if (!idName && !secretName && codeAsName.length === 0) {
    hints.push(
      'Der Server sieht noch gar keine Spotify-Variablen. Nach dem Eintragen bei Render „Save, rebuild, and deploy“ wählen – „Save only“ reicht nicht. Oder oben rechts „Manual Deploy → Deploy latest commit“.',
    );
  }

  return {
    clientId,
    clientSecret,
    status: {
      idFound: !!clientId,
      secretFound: !!clientSecret,
      login: 'unknown',
      loginError: null,
      hints,
    },
  };
}

/** Land für die Diskografie: zwei Buchstaben, sonst DE. Leer gesetzt = alle Länder. */
export function readMarket(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.SPOTIFY_MARKET;
  if (raw === undefined) return 'DE';
  const v = clean(raw);
  if (v === '') return '';
  return /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : 'DE';
}
