import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, type WebSocket } from 'ws';
import { GameServer } from './game';
import { createHttpHandler } from './http';
import { DemoProvider } from './music/demo';
import { MissingKeysProvider } from './music/missing';
import { readMarket, readSpotifyKeys } from './setup';
import { SpotifyProvider } from './music/spotify';
import { DeezerProvider } from './music/deezerProvider';
import type { MusicProvider } from './music/types';
import type { ItemKind } from '../shared/types';
import { KvClient } from './kv';
import { UsageCounter } from './usage';

// .env laden (Node ≥ 20.12 kann das ohne Zusatzpaket)
try {
  process.loadEnvFile();
} catch {
  /* keine .env vorhanden – dann eben Umgebungsvariablen oder Demo-Modus */
}

const PORT = Number(process.env.PORT) || 3001;
const keys = readSpotifyKeys();
const { clientId, clientSecret } = keys;
const setup = keys.status;
const market = readMarket();
const forceDemo = process.env.DEMO === '1' || process.env.DEMO === 'true';
// Standard: Deezer (kein Key, kein Tageskontingent). Spotify nur noch mit MUSIC_SOURCE=spotify.
const useSpotify = (process.env.MUSIC_SOURCE || '').trim().toLowerCase() === 'spotify';

// Dauerhafter Zwischenspeicher (Render Key Value) – optional
const kvUrl = (process.env.REDIS_URL || process.env.KV_URL || '').trim();
const kv = kvUrl ? new KvClient(kvUrl) : null;
if (kv) {
  kv.ping().then((ok) =>
    console.log(ok ? `💾 Zwischenspeicher verbunden (${kv.label})` : `⚠️  Zwischenspeicher ${kv.label} nicht erreichbar – es geht auch ohne`),
  );
} else {
  console.log('ℹ️  Kein Zwischenspeicher (REDIS_URL) – Daten bleiben nur bis zum nächsten Neustart.');
}
const usage = new UsageCounter(kv);

let provider: MusicProvider;
let spotifyHelper: SpotifyProvider | null = null;
let recheckLogin = () => {};
let cooldown = () => 0;
if (useSpotify) for (const hint of setup.hints) console.warn(`ℹ️  ${hint}`);
if (forceDemo) {
  provider = new DemoProvider();
  console.log('🧪 Demo-Modus aktiv (DEMO=1) – erfundene Artists, kein Spotify.');
} else if (!useSpotify) {
  // Alles von Deezer; mit Spotify-Keys zusätzlich Profilbilder und „Erscheint auf“ von Spotify
  const helper = clientId && clientSecret ? new SpotifyProvider(clientId, clientSecret, market, { remote: kv, usage }) : null;
  spotifyHelper = helper;
  provider = new DeezerProvider({ remote: kv, spotify: helper });
  console.log(`🎧 Musikdaten: Deezer${helper ? ' + Spotify (Profilbilder, Erscheint auf)' : ' (ohne Key, ohne Tageskontingent)'}`);
} else if (clientId && clientSecret) {
  const spotify = new SpotifyProvider(clientId, clientSecret, market, { remote: kv, usage });
  provider = spotify;
  cooldown = () => spotify.cooldownSeconds;
  console.log(`🎧 Musikdaten: Spotify (Markt: ${market || 'alle'})`);
  // Login gleich beim Start testen, damit die Startseite sagen kann, ob die Keys stimmen
  let lastCheck = 0;
  const check = async () => {
    lastCheck = Date.now();
    const error = await spotify.verify();
    setup.login = error ? 'failed' : 'ok';
    setup.loginError = error;
    console.log(error ? `❌ Spotify-Login fehlgeschlagen: ${error}` : '✅ Spotify-Login klappt');
  };
  void check();
  recheckLogin = () => {
    if (setup.login !== 'ok' && Date.now() - lastCheck > 30_000) void check();
  };
} else {
  provider = new MissingKeysProvider();
  console.warn(
    '⚠️  Keine Spotify-Keys gefunden! Trag SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET ein\n' +
      '   (bei Render unter "Environment", lokal in der .env) und starte den Server neu.\n' +
      '   Nur zum Ausprobieren ohne Spotify: DEMO=1 setzen.',
  );
}

const handler = createHttpHandler(provider, async () => {
  recheckLogin();
  const isDemo = provider.name === 'demo';
  return {
    demo: isDemo,
    missingKeys: provider.name === 'missing' || (provider.name === 'spotify' && setup.login === 'failed'),
    setup: provider.name === 'spotify' || provider.name === 'missing' ? setup : null,
    cooldownSeconds: cooldown(),
    usage: provider.name === 'spotify' || spotifyHelper ? await usage.info() : null,
  };
});
const server = createServer((req, res) => void handler(req, res));

// Artist-Seiten vorab in den Cache laden (Start-Artist in der Lobby, neuer Artist nach jedem Sprung).
// Nur die Kategorien, die die Seite sofort zeigt – genau das würde der Browser gleich sowieso laden.
const warm = (artistId: string) => {
  provider.getArtist(artistId).catch(() => {});
  provider.getInitialSections(artistId).catch(() => {});
};

// WebSocket für Lobby und Spiel
// Nur im Demo-Modus (für automatische Tests): feste Reihenfolge der Item-Kisten, z. B. DEMO_ITEMS=freeze,ink
const itemSequence = provider.name === 'demo' && process.env.DEMO_ITEMS ? (process.env.DEMO_ITEMS.split(',').map((s) => s.trim()) as ItemKind[]) : undefined;
const game = new GameServer(provider, warm, provider.name === 'spotify' || spotifyHelper ? usage : null, { itemSequence });
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const alive = new WeakMap<WebSocket, boolean>();

wss.on('connection', (ws) => {
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));
  game.attach(ws);
});

// Tote Verbindungen erkennen und Proxys (z. B. beim Hosting) wach halten
setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 25_000).unref();

// Render beendet den alten Server bei jedem Deploy mit SIGTERM → Zähler vorher sichern
process.once('SIGTERM', () => {
  void usage.flush().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
});

server.listen(PORT, () => {
  console.log(`\n🏁 Spotirace-Server läuft auf http://localhost:${PORT}`);
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
  if (ips.length) {
    console.log(`   Im selben WLAN: ${ips.map((ip) => `http://${ip}:${PORT}`).join('  ')}`);
    console.log('   (im Entwicklungsmodus stattdessen Port 5173)\n');
  }
});
