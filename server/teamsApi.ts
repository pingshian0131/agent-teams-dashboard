import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TeamOverview } from '../src/types.js';
import * as cache from './teamsCache.js';
import { searchConversations } from './search.js';

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

  // GET /api/search?q=keyword&project=projectDir&limit=50&days=30
  if (path === '/api/search') {
    const q = url.searchParams.get('q') ?? '';
    const project = url.searchParams.get('project') ?? undefined;
    const limitParam = url.searchParams.get('limit');
    const daysParam = url.searchParams.get('days');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const maxAgeDays = daysParam ? parseInt(daysParam, 10) : undefined;

    if (!q || q.length < 2) {
      json(res, { error: 'Query must be at least 2 characters' }, 400);
      return true;
    }

    try {
      const results = await searchConversations({
        query: q,
        projectDir: project,
        limit: limit && !isNaN(limit) && limit > 0 ? limit : undefined,
        maxAgeDays: maxAgeDays && !isNaN(maxAgeDays) && maxAgeDays > 0 ? maxAgeDays : undefined,
      });
      json(res, results);
    } catch (err) {
      json(res, { error: 'Search failed' }, 500);
    }
    return true;
  }

  notFound(res);
  return true;
}
