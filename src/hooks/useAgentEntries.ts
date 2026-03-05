import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentLogEntry } from '../types';

const PAGE_SIZE = 50;
const STORAGE_KEY = 'dashboard_auth_token';

interface UseAgentEntriesResult {
  entries: AgentLogEntry[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export function useAgentEntries(
  agentId: string | null,
  sessionId?: string,
): UseAgentEntriesResult {
  const [entries, setEntries] = useState<AgentLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const currentAgentId = useRef(agentId);

  currentAgentId.current = agentId;

  // Initial fetch when agentId/sessionId changes
  useEffect(() => {
    if (!agentId) {
      setEntries([]);
      setHasMore(true);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const url = sessionId
      ? `/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}`
      : `/api/agents/${encodeURIComponent(agentId)}/activity?limit=${PAGE_SIZE}`;

    const authToken = localStorage.getItem(STORAGE_KEY);
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    fetch(url, { headers })
      .then((r) => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth-required')); return []; }
        return r.json();
      })
      .then((data: AgentLogEntry[]) => {
        if (cancelled) return;
        setEntries(data);
        setHasMore(!sessionId && data.length >= PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [agentId, sessionId]);

  // Listen for delta events dispatched by useTeamsSocket
  useEffect(() => {
    if (!agentId) return;

    const handler = (e: Event) => {
      const { agentId: deltaAgentId, entries: newEntries } = (e as CustomEvent).detail as {
        agentId: string;
        entries: AgentLogEntry[];
      };
      if (deltaAgentId !== currentAgentId.current) return;

      const filtered = sessionId
        ? newEntries.filter((entry: AgentLogEntry) => entry.sessionId === sessionId)
        : newEntries;
      if (filtered.length === 0) return;

      setEntries((prev) => {
        const existingKeys = new Set(prev.map((entry) => `${entry.timestamp}:${entry.type}`));
        const unique = filtered.filter(
          (entry: AgentLogEntry) => !existingKeys.has(`${entry.timestamp}:${entry.type}`),
        );
        return unique.length > 0 ? [...prev, ...unique] : prev;
      });
    };

    window.addEventListener('agent-entries-delta', handler);
    return () => window.removeEventListener('agent-entries-delta', handler);
  }, [agentId, sessionId]);

  // Load more (older entries)
  const loadMore = useCallback(() => {
    if (!agentId || loading || !hasMore || sessionId) return;

    setLoading(true);
    const offset = entries.length;

    const authToken = localStorage.getItem(STORAGE_KEY);
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    fetch(
      `/api/agents/${encodeURIComponent(agentId)}/activity?limit=${PAGE_SIZE}&offset=${offset}`,
      { headers },
    )
      .then((r) => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth-required')); return []; }
        return r.json();
      })
      .then((data: AgentLogEntry[]) => {
        if (currentAgentId.current !== agentId) return;
        setEntries((prev) => [...data, ...prev]);
        setHasMore(data.length >= PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [agentId, loading, hasMore, entries.length, sessionId]);

  return { entries, loading, hasMore, loadMore };
}
