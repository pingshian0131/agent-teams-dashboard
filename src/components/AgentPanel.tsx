import { useEffect, useRef, useState } from 'react';
import { useAgentEntries } from '../hooks/useAgentEntries';
import ActivityEntry from './ActivityEntry';

interface AgentPanelProps {
  agentId: string;
  agentSlug: string;
  teamName?: string;
  sessionId?: string;
}

function getSessionLabel(sessionId: string): string {
  return sessionId.slice(0, 8);
}

export default function AgentPanel({ agentId, agentSlug, teamName, sessionId }: AgentPanelProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const { entries, loading, hasMore, loadMore } = useAgentEntries(agentId, sessionId);

  const lastEntry = entries[entries.length - 1];
  const statusLabel = lastEntry
    ? Date.now() - new Date(lastEntry.timestamp).getTime() < 60_000
      ? 'active'
      : 'idle'
    : 'unknown';

  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [entries.length, autoScroll]);

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
          <span className="text-xs text-muted">{entries.length} msgs</span>
        </div>
      </div>

      <div className="chat-panel__feed" ref={feedRef} onScroll={handleScroll}>
        {hasMore && !sessionId && (
          <div style={{ textAlign: 'center', padding: '8px' }}>
            <button
              className="chat-panel__load-more"
              onClick={loadMore}
              disabled={loading}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                padding: '4px 12px',
                borderRadius: '4px',
                cursor: loading ? 'wait' : 'pointer',
                fontSize: '12px',
              }}
            >
              {loading ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}
        {entries.length === 0 && !loading ? (
          <div className="chat-panel__empty">
            <span className="text-muted">No messages yet</span>
          </div>
        ) : (
          entries.map((entry, i) => (
            <ActivityEntry key={`${entry.timestamp}-${i}`} entry={entry} />
          ))
        )}
        {loading && entries.length === 0 && (
          <div className="chat-panel__empty">
            <span className="text-muted">Loading...</span>
          </div>
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
