import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, type WebSocket } from 'ws';
import { GameServer } from './game';
import { createHttpHandler } from './http';
import { DemoProvider } from './music/demo';
import { SpotifyProvider } from './music/spotify';
import type { MusicProvider } from './music/types';

// .env laden (Node ≥ 20.12 kann das ohne Zusatzpaket)
try {
  process.loadEnvFile();
} catch {
  /* keine .env vorhanden – dann eben Umgebungsvariablen oder Demo-Modus */
}

const PORT = Number(process.env.PORT) || 3001;
const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() ?? '';
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? '';
const market = process.env.SPOTIFY_MARKET?.trim() ?? 'DE';
const forceDemo = process.env.DEMO === '1' || process.env.DEMO === 'true';

let provider: MusicProvider;
if (!forceDemo && clientId && clientSecret) {
  provider = new SpotifyProvider(clientId, clientSecret, market);
  console.log(`🎧 Musikdaten: Spotify (Markt: ${market || 'alle'})`);
} else {
  provider = new DemoProvider();
  console.log(
    forceDemo
      ? '🧪 Demo-Modus aktiv (DEMO=1) – erfundene Artists, kein Spotify.'
      : '🧪 Keine Spotify-Keys gefunden → Demo-Modus mit erfundenen Artists.\n   Trag SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET in die .env ein, um mit echten Daten zu spielen.',
  );
}

const handler = createHttpHandler(provider, { demo: provider.name === 'demo' });
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
