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

  const idName = pick('SPOTIFY_CLIENT_ID', (n) => n.includes('clientid') || n === 'spotifyid' || n === 'id');
  const secretName = pick(
    'SPOTIFY_CLIENT_SECRET',
    (n) => n.includes('clientsecret') || n === 'spotifysecret' || n === 'secret' || n === 'clientsecrect',
  );
  const clientId = idName ? clean(env[idName]) : '';
  const clientSecret = secretName ? clean(env[secretName]) : '';

  const hints: string[] = [];
  const codeAsName = names.filter((n) => HEX32.test(n.trim()));
  if (codeAsName.length > 0) {
    hints.push(
      'Bei Render steht ein Code im linken Feld „Key“. Links gehört der NAME hin (SPOTIFY_CLIENT_ID bzw. SPOTIFY_CLIENT_SECRET), rechts bei „Value“ der Code.',
    );
  }
  if (idName && idName !== 'SPOTIFY_CLIENT_ID') hints.push(`Client ID gefunden unter „${idName}“ – funktioniert, besser wäre der Name SPOTIFY_CLIENT_ID.`);
  if (secretName && secretName !== 'SPOTIFY_CLIENT_SECRET') {
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
