import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { handleTeamsApi } from './teamsApi.js';
import { initWebSocket } from './wsServer.js';
import { startWatching } from './teamsWatcher.js';
import * as cache from './teamsCache.js';
import { checkAuth, isAuthEnabled } from './auth.js';

const PORT = Number(process.env.PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const DIST_DIR = process.env.DIST_DIR ?? join(import.meta.dirname, '..', 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveStatic(url: string, res: import('node:http').ServerResponse): Promise<boolean> {
  if (!existsSync(DIST_DIR)) return false;

  let filePath = join(DIST_DIR, url === '/' ? 'index.html' : url);

  // SPA fallback: if file doesn't exist and it's not an API/asset route, serve index.html
  if (!existsSync(filePath)) {
    const ext = extname(filePath);
    if (!ext) {
      filePath = join(DIST_DIR, 'index.html');
    } else {
      return false;
    }
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes — require auth
  if (url.startsWith('/api/')) {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  try {
    const handled = await handleTeamsApi(req, res);
    if (handled) return;
  } catch (err) {
    console.error('[api] Error handling request:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
    return;
  }

  // Static file serving (production)
  const served = await serveStatic(url, res);
  if (served) return;

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

async function start(): Promise<void> {
  // Initialize cache
  await cache.refreshAll();
  console.log(`[cache] Initial load complete`);

  // Start HTTP server
  server.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
    if (isAuthEnabled()) {
      console.log('[server] AUTH_TOKEN is set — authentication enabled');
    }
  });

  // Attach WebSocket
  initWebSocket(server);

  // Start file watchers
  startWatching();
  console.log('[watcher] File watchers started');
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
