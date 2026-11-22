import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, type WebSocket } from 'ws';
import { GameServer } from './game';
import { createHttpHandler } from './http';
import { DemoProvider } from './music/demo';
import { MissingKeysProvider } from './music/missing';
import { readSpotifyKeys } from './setup';
import { SpotifyProvider } from './music/spotify';
import type { MusicProvider } from './music/types';

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
const market = process.env.SPOTIFY_MARKET?.trim() ?? 'DE';
const forceDemo = process.env.DEMO === '1' || process.env.DEMO === 'true';

let provider: MusicProvider;
let recheckLogin = () => {};
for (const hint of setup.hints) console.warn(`ℹ️  ${hint}`);
if (forceDemo) {
  provider = new DemoProvider();
  console.log('🧪 Demo-Modus aktiv (DEMO=1) – erfundene Artists, kein Spotify.');
} else if (clientId && clientSecret) {
  const spotify = new SpotifyProvider(clientId, clientSecret, market);
  provider = spotify;
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

const handler = createHttpHandler(provider, () => {
  recheckLogin();
  const isDemo = provider.name === 'demo';
  return {
    demo: isDemo,
    missingKeys: !isDemo && (provider.name === 'missing' || setup.login === 'failed'),
    setup: isDemo ? null : setup,
  };
});
const server = createServer((req, res) => void handler(req, res));

// WebSocket für Lobby und Spiel
const game = new GameServer(provider);
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
