import { useEffect, useRef, useState } from 'react';
import type { AgentLogEntry, TeamTask } from '../types';
import ActivityEntry from './ActivityEntry';

interface AgentPanelProps {
  agentId: string;
  agentSlug: string;
  entries: AgentLogEntry[];
  teamName?: string;
  tasks?: TeamTask[];
}

export default function AgentPanel({ agentId, agentSlug, entries, teamName, tasks }: AgentPanelProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const myTasks = tasks?.filter((t) => t.owner === agentSlug) ?? [];

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [entries.length, autoScroll]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  // Determine agent status from last entry
  const lastEntry = entries[entries.length - 1];
  const statusLabel = lastEntry
    ? Date.now() - new Date(lastEntry.timestamp).getTime() < 60_000
      ? 'active'
      : 'idle'
    : 'unknown';

  return (
    <div className="agent-panel">
      <div className="agent-panel__header">
        <div className="flex items-center gap-2">
          <h2 className="panel-title">{agentSlug}</h2>
          <span className={`status-badge status-badge--${statusLabel}`}>{statusLabel}</span>
        </div>
        {teamName && <span className="text-xs text-muted">Team: {teamName}</span>}
        <span className="text-xs text-muted">ID: {agentId.slice(0, 8)}</span>
      </div>

      {myTasks.length > 0 && (
        <div className="agent-panel__tasks">
          <h3 className="text-xs text-muted" style={{ marginBottom: 4 }}>Assigned Tasks</h3>
          {myTasks.map((t) => (
            <div key={t.id} className="agent-panel__task-item">
              <span className={`task-status-dot task-status-dot--${t.status}`} />
              <span>#{t.id} {t.subject}</span>
            </div>
          ))}
        </div>
      )}

      <div className="agent-panel__feed" ref={feedRef} onScroll={handleScroll}>
        {entries.length === 0 ? (
          <div className="text-muted" style={{ padding: 16, textAlign: 'center' }}>
            No activity yet
          </div>
        ) : (
          entries.map((entry, i) => <ActivityEntry key={`${entry.timestamp}-${i}`} entry={entry} />)
        )}
      </div>
    </div>
  );
}
