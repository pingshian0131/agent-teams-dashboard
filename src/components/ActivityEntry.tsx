import type { AgentLogEntry, MessageContent } from '../types';

interface ActivityEntryProps {
  entry: AgentLogEntry;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function renderContent(content: MessageContent) {
  switch (content.type) {
    case 'text':
      return (
        <div className="activity-entry__text">
          {content.text.includes('```') ? (
            <pre className="activity-entry__code">{truncate(content.text, 500)}</pre>
          ) : (
            <span>{truncate(content.text, 500)}</span>
          )}
        </div>
      );
    case 'tool_use':
      return (
        <div className="activity-entry__tool-use">
          <span className="activity-entry__tool-badge">🔧 {content.name}</span>
          <span className="activity-entry__tool-input text-muted">
            {truncate(JSON.stringify(content.input), 200)}
          </span>
        </div>
      );
    case 'tool_result':
      return (
        <div className="activity-entry__tool-result text-muted">
          {content.is_error && <span className="text-red">[error] </span>}
          {truncate(content.content, 300)}
        </div>
      );
  }
}

export default function ActivityEntry({ entry }: ActivityEntryProps) {
  const isUser = entry.type === 'user';
  const contents = entry.message.content;

  const hasToolUse = contents.some((c) => c.type === 'tool_use');
  const hasToolResult = contents.some((c) => c.type === 'tool_result');

  let className = 'activity-entry';
  if (isUser && !hasToolResult) className += ' activity-entry--user';
  else if (!isUser && !hasToolUse) className += ' activity-entry--assistant';
  else if (hasToolUse) className += ' activity-entry--tool-use';
  else if (hasToolResult) className += ' activity-entry--tool-result';

  return (
    <div className={className}>
      <div className="activity-entry__header">
        <span className="activity-entry__role text-xs">
          {isUser ? (hasToolResult ? 'tool_result' : 'user') : hasToolUse ? 'tool_use' : 'assistant'}
        </span>
        <span className="activity-entry__time text-xs text-muted">{formatTime(entry.timestamp)}</span>
      </div>
      <div className="activity-entry__body">
        {contents.map((c, i) => (
          <div key={i}>{renderContent(c)}</div>
        ))}
      </div>
    </div>
  );
}
