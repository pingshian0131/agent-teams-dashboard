import { useEffect, useRef, useState } from 'react';
import type { AgentLogEntry } from '../types';
import ActivityEntry from './ActivityEntry';

interface AgentPanelProps {
  agentId: string;
  agentSlug: string;
  entries: AgentLogEntry[];
  teamName?: string;
  sessionId?: string;
}

function getSessionLabel(sessionId: string): string {
  return sessionId.slice(0, 8);
}

export default function AgentPanel({ agentId, agentSlug, entries, teamName, sessionId }: AgentPanelProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filtered = sessionId ? entries.filter((e) => e.sessionId === sessionId) : entries;

  const lastEntry = filtered[filtered.length - 1];
  const statusLabel = lastEntry
    ? Date.now() - new Date(lastEntry.timestamp).getTime() < 60_000
      ? 'active'
      : 'idle'
    : 'unknown';

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  return (
    <div className="chat-panel">
      <div className="chat-panel__header">
        <div className="chat-panel__header-left">
          <span className="chat-panel__agent-name">{agentSlug}</span>
          <span className={`status-badge status-badge--${statusLabel}`}>{statusLabel}</span>
          {sessionId && (
            <span className="chat-panel__session-tag">session:{getSessionLabel(sessionId)}</span>
          )}
        </div>
        <div className="chat-panel__header-right">
          {teamName && <span className="chat-panel__team text-xs text-muted">{teamName}</span>}
          <span className="text-xs text-muted">{filtered.length} msgs</span>
        </div>
      </div>

      <div className="chat-panel__feed" ref={feedRef} onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <div className="chat-panel__empty">
            <span className="text-muted">No messages yet</span>
          </div>
        ) : (
          filtered.map((entry, i) => (
            <ActivityEntry key={`${entry.timestamp}-${i}`} entry={entry} />
          ))
        )}
      </div>

      {!autoScroll && (
        <button
          className="chat-panel__scroll-btn"
          onClick={() => {
            setAutoScroll(true);
            if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
          }}
        >
          ↓ scroll to bottom
        </button>
      )}
    </div>
  );
}
