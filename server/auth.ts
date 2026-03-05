import type { IncomingMessage } from 'node:http';

const AUTH_TOKEN = process.env.AUTH_TOKEN;

export function isAuthEnabled(): boolean {
  return !!AUTH_TOKEN;
}

export function checkAuth(req: IncomingMessage): boolean {
  if (!AUTH_TOKEN) return true;

  // Check query param ?token=xxx
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (url.searchParams.get('token') === AUTH_TOKEN) return true;

  // Check Authorization: Bearer xxx
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ') && h.slice(7) === AUTH_TOKEN) return true;

  return false;
}
