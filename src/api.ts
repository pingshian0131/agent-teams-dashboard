import type { FullSnapshot, AgentLogEntry, SearchResult } from './types';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function fetchSnapshot(): Promise<FullSnapshot> {
  return fetchJson<FullSnapshot>('/api/snapshot');
}

export function fetchAgentActivity(agentId: string, limit?: number): Promise<AgentLogEntry[]> {
  const params = limit ? `?limit=${limit}` : '';
  return fetchJson<AgentLogEntry[]>(`/api/agents/${encodeURIComponent(agentId)}/activity${params}`);
}

export function fetchSearch(query: string, projectDir?: string, limit = 50): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (projectDir) params.set('project', projectDir);
  if (limit !== 50) params.set('limit', String(limit));
  return fetchJson<SearchResult[]>(`/api/search?${params}`);
}
