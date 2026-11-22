import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RELEASE_GROUPS,
  type AppConfig,
  type ArtistPage,
  type ReleaseGroup,
  type ReleasePage,
} from '../shared/types';
import { demoSvg } from './music/demo';
import { ProviderError, type MusicProvider } from './music/types';

const DIST_DIR = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PAGE_SIZE = 50;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function sendError(res: ServerResponse, err: unknown) {
  if (err instanceof ProviderError) {
    sendJson(res, err.status, { error: err.message });
    return;
  }
  console.error('[http] Fehler:', err);
  sendJson(res, 500, { error: 'Interner Fehler' });
}

function emptyPage(group: ReleaseGroup, error: string): ReleasePage {
  return { group, items: [], total: 0, offset: 0, next: null, error };
}

export function createHttpHandler(provider: MusicProvider, getConfig: () => AppConfig) {
  async function handleApi(url: URL, res: ServerResponse) {
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

    if (parts[1] === 'config') return sendJson(res, 200, getConfig());

    if (parts[1] === 'search') {
      const q = (url.searchParams.get('q') ?? '').slice(0, 100);
      return sendJson(res, 200, await provider.searchArtists(q));
    }

    if (parts[1] === 'random-artist') {
      const exclude = (url.searchParams.get('exclude') ?? '').split(',').filter(Boolean);
      return sendJson(res, 200, await provider.randomArtist(exclude));
    }

    if (parts[1] === 'artist' && parts[2] && ID_RE.test(parts[2])) {
      const id = parts[2];
      if (parts[3] === 'releases') {
        const group = url.searchParams.get('group') as ReleaseGroup;
        if (!RELEASE_GROUPS.includes(group)) return sendJson(res, 400, { error: 'Ungültige Kategorie' });
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        return sendJson(res, 200, await provider.getReleases(id, group, offset, PAGE_SIZE));
      }
      const [artist, ...pages] = await Promise.all([
        provider.getArtist(id),
        ...RELEASE_GROUPS.map((group) =>
          provider.getReleases(id, group, 0, PAGE_SIZE).catch((err: unknown) => {
            // Eine Kategorie darf fehlschlagen, ohne die ganze Seite zu blockieren
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[http] Kategorie ${group} für ${id} fehlgeschlagen: ${message}`);
            return emptyPage(group, message);
          }),
        ),
      ]);
      const body: ArtistPage = {
        artist,
        sections: Object.fromEntries(pages.map((p) => [p.group, p])) as ArtistPage['sections'],
      };
      return sendJson(res, 200, body);
    }

    if (parts[1] === 'album' && parts[2] && ID_RE.test(parts[2])) {
      return sendJson(res, 200, await provider.getAlbum(parts[2]));
    }

    sendJson(res, 404, { error: 'Nicht gefunden' });
  }

  function serveStatic(pathname: string, res: ServerResponse) {
    if (!existsSync(DIST_DIR)) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        'Spotirace-Server läuft.\n\nIm Entwicklungsmodus öffnest du http://localhost:5173\n' +
          'Für den Produktivbetrieb zuerst "npm run build" ausführen.',
      );
      return;
    }
    let filePath = normalize(join(DIST_DIR, decodeURIComponent(pathname)));
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      // SPA-Fallback: alle unbekannten Pfade liefern die App aus
      filePath = join(DIST_DIR, 'index.html');
    }
    const ext = extname(filePath);
    const isAsset = filePath.includes(`${join(DIST_DIR, 'assets')}`);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(filePath).pipe(res);
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        res.end();
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        await handleApi(url, res);
        return;
      }

      const demoMatch = url.pathname.match(/^\/demo\/(cover|artist)\/([A-Za-z0-9_-]+)\.svg$/);
      if (demoMatch) {
        const svg = demoSvg(demoMatch[1] as 'cover' | 'artist', demoMatch[2]);
        if (!svg) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
        res.end(svg);
        return;
      }

      serveStatic(url.pathname, res);
    } catch (err) {
      sendError(res, err);
    }
  };
}
