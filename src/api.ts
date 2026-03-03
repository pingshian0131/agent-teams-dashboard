import type { FullSnapshot, AgentLogEntry } from './types';

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
