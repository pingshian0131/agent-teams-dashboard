import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TeamOverview } from '../src/types.js';
import * as cache from './teamsCache.js';

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function notFound(res: ServerResponse): void {
  json(res, { error: 'Not found' }, 404);
}

export async function handleTeamsApi(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (!req.url?.startsWith('/api/')) return false;

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  // GET /api/snapshot
  if (path === '/api/snapshot') {
    json(res, cache.getLeanSnapshot());
    return true;
  }

  // GET /api/teams
  if (path === '/api/teams') {
    const snapshot = cache.getLeanSnapshot();
    json(res, snapshot.teams);
    return true;
  }

  // GET /api/teams/:id/tasks
  const tasksMatch = path.match(/^\/api\/teams\/([^/]+)\/tasks$/);
  if (tasksMatch) {
    const teamId = decodeURIComponent(tasksMatch[1]);
    const snapshot = cache.getLeanSnapshot();
    const team = snapshot.teams.find((t: TeamOverview) => t.config.name === teamId);
    if (!team) {
      notFound(res);
      return true;
    }
    json(res, team.tasks);
    return true;
  }

  // GET /api/teams/:id
  const teamMatch = path.match(/^\/api\/teams\/([^/]+)$/);
  if (teamMatch) {
    const teamId = decodeURIComponent(teamMatch[1]);
    const snapshot = cache.getLeanSnapshot();
    const team = snapshot.teams.find((t: TeamOverview) => t.config.name === teamId);
    if (!team) {
      notFound(res);
      return true;
    }
    json(res, team);
    return true;
  }

  // GET /api/agents/:agentId/sessions/:sessionId
  const sessionDetailMatch = path.match(/^\/api\/agents\/([^/]+)\/sessions\/([^/]+)$/);
  if (sessionDetailMatch) {
    const agentId = decodeURIComponent(sessionDetailMatch[1]);
    const sessionId = decodeURIComponent(sessionDetailMatch[2]);
    const entries = cache.getSessionEntries(agentId, sessionId);
    json(res, entries);
    return true;
  }

  // GET /api/agents/:agentId/sessions
  const sessionsMatch = path.match(/^\/api\/agents\/([^/]+)\/sessions$/);
  if (sessionsMatch) {
    const agentId = decodeURIComponent(sessionsMatch[1]);
    const sessions = cache.getAgentSessions(agentId);
    json(res, sessions);
    return true;
  }

  // GET /api/agents/:agentId/activity
  const agentMatch = path.match(/^\/api\/agents\/([^/]+)\/activity$/);
  if (agentMatch) {
    const agentId = decodeURIComponent(agentMatch[1]);
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;
    const entries = cache.getAgentActivity(
      agentId,
      limit && !isNaN(limit) && limit > 0 ? limit : undefined,
      offset && !isNaN(offset) && offset >= 0 ? offset : undefined,
    );
    json(res, entries);
    return true;
  }

  notFound(res);
  return true;
}
