import { useState, useEffect, useRef, useCallback } from 'react';
import type { FullSnapshot, WsEvent } from '../types';

const WS_RECONNECT_DELAY = 3000;

export function useTeamsSocket() {
  const [snapshot, setSnapshot] = useState<FullSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const msg: WsEvent = JSON.parse(event.data);

        setLastUpdated(Date.now());

        switch (msg.type) {
          case 'snapshot':
            setSnapshot(msg.data);
            break;

          case 'tasks_updated':
            setSnapshot((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                teams: prev.teams.map((t) =>
                  t.config.name === msg.teamId
                    ? {
                        ...t,
                        tasks: msg.tasks,
                        taskStats: {
                          total: msg.tasks.length,
                          pending: msg.tasks.filter((tk) => tk.status === 'pending').length,
                          inProgress: msg.tasks.filter((tk) => tk.status === 'in_progress').length,
                          completed: msg.tasks.filter((tk) => tk.status === 'completed').length,
                        },
                      }
                    : t,
                ),
              };
            });
            break;

          case 'team_updated':
            setSnapshot((prev) => {
              if (!prev) return prev;
              const idx = prev.teams.findIndex((t) => t.config.name === msg.team.config.name);
              const teams = [...prev.teams];
              if (idx >= 0) {
                teams[idx] = msg.team;
              } else {
                teams.push(msg.team);
              }
              return { ...prev, teams };
            });
            break;

          case 'team_removed':
            setSnapshot((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                teams: prev.teams.filter((t) => t.config.name !== msg.teamId),
              };
            });
            break;

          case 'agent_activity':
          case 'agent_entries_delta':
            // Dispatch to useAgentEntries listeners via CustomEvent
            window.dispatchEvent(new CustomEvent('agent-entries-delta', {
              detail: { agentId: msg.agentId, entries: msg.entries },
            }));
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { snapshot, connected, lastUpdated };
}
