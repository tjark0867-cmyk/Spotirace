import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
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
export const PAGE_SIZE = 50;

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

function acceptsGzip(req: IncomingMessage | null) {
  return /\bgzip\b/.test(String(req?.headers['accept-encoding'] ?? ''));
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, body: unknown, cacheSeconds = 0) {
  const json = JSON.stringify(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheSeconds > 0 ? `private, max-age=${cacheSeconds}` : 'no-store',
    Vary: 'Accept-Encoding',
  };
  // Größere Antworten komprimieren → deutlich schneller übers Handy-Netz
  if (json.length > 1024 && acceptsGzip(req)) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(status, headers);
    res.end(gzipSync(json, { level: 6 }));
    return;
  }
  res.writeHead(status, headers);
  res.end(json);
}

/** Alle Dateien aus dist/ einmal beim Start laden und vorkomprimieren (Brotli + Gzip) */
interface StaticFile {
  raw: Buffer;
  br: Buffer | null;
  gz: Buffer | null;
  type: string;
  immutable: boolean;
}
function loadStatic(dir: string): Map<string, StaticFile> {
  const files = new Map<string, StaticFile>();
  if (!existsSync(dir)) return files;
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  for (const path of walk(dir)) {
    const raw = readFileSync(path);
    const ext = extname(path);
    const compressible = ['.html', '.js', '.css', '.svg', '.json', '.txt'].includes(ext) && raw.length > 512;
    files.set('/' + relative(dir, path).split('\\').join('/'), {
      raw,
      br: compressible ? brotliCompressSync(raw, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 10 } }) : null,
      gz: compressible ? gzipSync(raw, { level: 9 }) : null,
      type: MIME[ext] ?? 'application/octet-stream',
      immutable: path.includes(join(dir, 'assets')),
    });
  }
  return files;
}

function sendError(req: IncomingMessage, res: ServerResponse, err: unknown) {
  if (err instanceof ProviderError) {
    sendJson(req, res, err.status, { error: err.message });
    return;
  }
  console.error('[http] Fehler:', err);
  sendJson(req, res, 500, { error: 'Interner Fehler' });
}

function emptyPage(group: ReleaseGroup, error: string): ReleasePage {
  return { group, items: [], total: 0, offset: 0, next: null, error };
}

export function createHttpHandler(provider: MusicProvider, getConfig: () => AppConfig) {
  async function handleApi(url: URL, req: IncomingMessage, res: ServerResponse) {
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

    if (parts[1] === 'config') return sendJson(req, res, 200, getConfig());

    if (parts[1] === 'search') {
      const q = (url.searchParams.get('q') ?? '').slice(0, 100);
      return sendJson(req, res, 200, await provider.searchArtists(q), 300);
    }

    if (parts[1] === 'popular') {
      return sendJson(req, res, 200, await provider.popularArtists(), 600);
    }

    if (parts[1] === 'random-artist') {
      const exclude = (url.searchParams.get('exclude') ?? '').split(',').filter(Boolean);
      return sendJson(req, res, 200, await provider.randomArtist(exclude));
    }

    if (parts[1] === 'artist' && parts[2] && ID_RE.test(parts[2])) {
      const id = parts[2];
      if (parts[3] === 'releases') {
        const group = url.searchParams.get('group') as ReleaseGroup;
        if (!RELEASE_GROUPS.includes(group)) return sendJson(req, res, 400, { error: 'Ungültige Kategorie' });
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        return sendJson(req, res, 200, await provider.getReleases(id, group, offset, PAGE_SIZE), 3600);
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
      return sendJson(req, res, 200, body, 3600);
    }

    if (parts[1] === 'album' && parts[2] && ID_RE.test(parts[2])) {
      return sendJson(req, res, 200, await provider.getAlbum(parts[2]), 3600);
    }

    sendJson(req, res, 404, { error: 'Nicht gefunden' });
  }

  const staticFiles = loadStatic(DIST_DIR);

  function serveStatic(req: IncomingMessage, pathname: string, res: ServerResponse) {
    if (staticFiles.size === 0) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        'Spotirace-Server läuft.\n\nIm Entwicklungsmodus öffnest du http://localhost:5173\n' +
          'Für den Produktivbetrieb zuerst "npm run build" ausführen.',
      );
      return;
    }
    let key = normalize(decodeURIComponent(pathname)).split('\\').join('/');
    // SPA-Fallback: alle unbekannten Pfade liefern die App aus
    if (!staticFiles.has(key)) key = '/index.html';
    const file = staticFiles.get(key)!;
    const accept = String(req.headers['accept-encoding'] ?? '');
    const headers: Record<string, string> = {
      'Content-Type': file.type,
      'Cache-Control': file.immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      Vary: 'Accept-Encoding',
    };
    let body = file.raw;
    if (file.br && /\bbr\b/.test(accept)) {
      body = file.br;
      headers['Content-Encoding'] = 'br';
    } else if (file.gz && /\bgzip\b/.test(accept)) {
      body = file.gz;
      headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = String(body.length);
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
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
        await handleApi(url, req, res);
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

      serveStatic(req, url.pathname, res);
    } catch (err) {
      sendError(req, res, err);
    }
  };
}
