import { useState, useEffect } from 'react';
import type { WorkflowRun, ViewSelection } from '../types';

const STORAGE_KEY = 'dashboard_auth_token';

interface WorkflowDetailPanelProps {
  runId: string;
  /** Lean runs from the snapshot, used for instant render before detail loads. */
  workflows: WorkflowRun[];
  onSelect: (sel: ViewSelection) => void;
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '–';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatNum(n?: number): string {
  if (n === undefined) return '–';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function stringifyResult(result: unknown): string {
  if (result === undefined || result === null) return '';
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export default function WorkflowDetailPanel({ runId, workflows, onSelect }: WorkflowDetailPanelProps) {
  const leanRun = workflows.find((w) => w.runId === runId) ?? null;
  const [detail, setDetail] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);

    const authToken = localStorage.getItem(STORAGE_KEY);
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    fetch(`/api/workflows/${encodeURIComponent(runId)}`, { headers })
      .then((r) => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth-required')); return null; }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data: WorkflowRun | null) => {
        if (cancelled) return;
        setDetail(data);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [runId]);

  const run = detail ?? leanRun;
  if (!run) {
    return (
      <div className="chat-panel">
        <div className="chat-panel__empty">
          <span className="text-muted">{loading ? 'Loading…' : 'Workflow not found'}</span>
        </div>
      </div>
    );
  }

  const resultText = stringifyResult(run.result);

  return (
    <div className="chat-panel">
      <div className="chat-panel__header">
        <div className="chat-panel__header-left">
          <span className="chat-panel__agent-name">{run.workflowName}</span>
          <span className={`status-badge status-badge--${run.status === 'running' ? 'active' : run.status === 'completed' ? 'done' : 'unknown'}`}>
            {run.status}
          </span>
        </div>
        <div className="chat-panel__header-right">
          <span className="chat-panel__project text-xs text-muted">{run.projectName}</span>
          <span className="text-xs text-muted">{run.runId}</span>
        </div>
      </div>

      <div className="chat-panel__feed" style={{ padding: '16px' }}>
        {run.summary && (
          <p style={{ margin: '0 0 16px', lineHeight: 1.5 }}>{run.summary}</p>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', fontSize: '13px' }}>
          <span className="text-muted">phases <strong className="text-secondary">{run.completedPhases}/{run.phases.length}</strong></span>
          <span className="text-muted">agents <strong className="text-secondary">{run.agentCount}</strong></span>
          <span className="text-muted">tokens <strong className="text-secondary">{formatNum(run.totalTokens)}</strong></span>
          <span className="text-muted">tool calls <strong className="text-secondary">{formatNum(run.totalToolCalls)}</strong></span>
          <span className="text-muted">duration <strong className="text-secondary">{formatDuration(run.durationMs)}</strong></span>
          {run.defaultModel && <span className="text-muted">model <strong className="text-secondary">{run.defaultModel}</strong></span>}
        </div>

        {/* Phases */}
        {run.phases.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Phases</h3>
            {run.phases.map((p, i) => {
              const done = i < run.completedPhases;
              const current = i === run.completedPhases && run.status === 'running';
              return (
                <div key={i} style={{ display: 'flex', gap: '8px', padding: '4px 0', alignItems: 'baseline' }}>
                  <span style={{ color: done ? 'var(--accent-cyan)' : current ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {done ? '✓' : current ? '◉' : '○'}
                  </span>
                  <div>
                    <span className="text-secondary">{p.title}</span>
                    {p.detail && <span className="text-muted text-xs" style={{ marginLeft: 8 }}>{p.detail}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sub-agents */}
        {run.agents.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>Sub-agents</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {run.agents.map((a) => (
                <button
                  key={a.agentId}
                  onClick={() => onSelect({ view: 'agent', agentId: a.agentId, agentSlug: a.slug, projectDir: run.projectDir })}
                  title={a.agentType}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px 10px',
                  }}
                >
                  ⚙ {a.slug} <span className="text-muted">{a.entryCount}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {resultText && (
          <details style={{ marginBottom: '12px' }} open>
            <summary className="text-xs text-muted" style={{ cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Result</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '4px', fontSize: '12px', marginTop: '8px' }}>
              {resultText}
            </pre>
          </details>
        )}

        {/* Script */}
        {run.script && (
          <details style={{ marginBottom: '12px' }}>
            <summary className="text-xs text-muted" style={{ cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Script</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '4px', fontSize: '12px', marginTop: '8px' }}>
              {run.script}
            </pre>
          </details>
        )}

        {/* Logs */}
        {Array.isArray(run.logs) && run.logs.length > 0 && (
          <details style={{ marginBottom: '12px' }}>
            <summary className="text-xs text-muted" style={{ cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logs ({run.logs.length})</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '4px', fontSize: '12px', marginTop: '8px' }}>
              {run.logs.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n')}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
