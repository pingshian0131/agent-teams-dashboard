import { useState } from 'react';
import type { AgentLogEntry, MessageContent } from '../types';

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function TextBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(text.length <= 800);
  const isLong = text.length > 800;
  const hasCode = text.includes('```') || text.includes('\n    ') || text.includes('\n  ');
  const display = expanded ? text : truncate(text, 800);

  return (
    <div className="msg-text">
      {hasCode ? (
        <pre className="msg-code">{display}</pre>
      ) : (
        <p className="msg-prose">{display}</p>
      )}
      {isLong && (
        <button className="msg-expand-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? '▲ collapse' : `▼ +${text.length - 800} chars`}
        </button>
      )}
    </div>
  );
}

function ToolUseBlock({ name, input }: { name: string; input: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const inputStr = JSON.stringify(input, null, 2);

  return (
    <div className="msg-tool-use">
      <button className="msg-tool-header" onClick={() => setExpanded(!expanded)}>
        <span className="msg-tool-name">{name}</span>
        <span className="msg-tool-toggle">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <pre className="msg-tool-body">{truncate(inputStr, 3000)}</pre>
      )}
    </div>
  );
}

function stringifyContent(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw == null) return '';
  try { return JSON.stringify(raw, null, 2); } catch { return String(raw); }
}

function ToolResultBlock({ content, isError }: { content: unknown; isError?: boolean }) {
  const text = stringifyContent(content);
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 400;
  const display = expanded || !isLong ? text : truncate(text, 400);

  return (
    <div className={`msg-tool-result ${isError ? 'msg-tool-result--error' : ''}`}>
      {isError && <span className="msg-error-badge">error</span>}
      <pre className="msg-result-body">{display}</pre>
      {isLong && (
        <button className="msg-expand-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? '▲ collapse' : `▼ +${text.length - 400} chars`}
        </button>
      )}
    </div>
  );
}

function renderBlock(c: MessageContent, i: number) {
  switch (c.type) {
    case 'text':
      return <TextBlock key={i} text={c.text} />;
    case 'tool_use':
      return <ToolUseBlock key={i} name={c.name} input={c.input} />;
    case 'tool_result':
      return <ToolResultBlock key={i} content={(c as any).content} isError={(c as any).is_error} />;
    default:
      return null;
  }
}

export default function ActivityEntry({ entry }: { entry: AgentLogEntry }) {
  const isUser = entry.type === 'user';
  const contents = entry.message.content;

  const hasToolUse = contents.some((c) => c.type === 'tool_use');
  const hasToolResult = contents.some((c) => c.type === 'tool_result');

  let role: string;
  let variant: string;

  if (isUser && hasToolResult) {
    role = 'tool_result';
    variant = 'tool-result';
  } else if (!isUser && hasToolUse) {
    role = 'tool_use';
    variant = 'tool-use';
  } else if (isUser) {
    role = 'user';
    variant = 'user';
  } else {
    role = 'assistant';
    variant = 'assistant';
  }

  return (
    <div className={`chat-msg chat-msg--${variant}`}>
      <div className="chat-msg__meta">
        <span className="chat-msg__role">{role}</span>
        <span className="chat-msg__time">{formatTime(entry.timestamp)}</span>
      </div>
      <div className="chat-msg__body">
        {contents.map((c, i) => renderBlock(c, i))}
      </div>
    </div>
  );
}
