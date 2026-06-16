import { useState, useEffect } from 'react';
import type { WorkflowRun, ViewSelection } from '../types';

interface WorkflowsOverviewPanelProps {
  workflows: WorkflowRun[];
  onSelect: (sel: ViewSelection) => void;
}

function timeAgo(startTime: number): string {
  if (!startTime) return '';
  const diff = Date.now() - startTime;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const statusBadge: Record<string, { label: string; className: string }> = {
  running:   { label: 'RUNNING',   className: 'status-badge--active' },
  completed: { label: 'COMPLETED', className: 'status-badge--done' },
  failed:    { label: 'FAILED',    className: 'status-badge--unknown' },
};

export default function WorkflowsOverviewPanel({ workflows, onSelect }: WorkflowsOverviewPanelProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const runningCount = workflows.filter((w) => w.status === 'running').length;
  const totalAgents = workflows.reduce((sum, w) => sum + w.agentCount, 0);

  return (
    <div className="overview-panel">
      <div className="convos-overview__header">
        <h2 className="panel-title">Workflows</h2>
        <div className="convos-overview__stats">
          <span className="convos-overview__stat">
            <span className="convos-overview__stat-value">{workflows.length}</span>
            <span className="convos-overview__stat-label">runs</span>
          </span>
          <span className="convos-overview__stat-divider" />
          <span className="convos-overview__stat">
            <span className="convos-overview__stat-value">{totalAgents}</span>
            <span className="convos-overview__stat-label">agents</span>
          </span>
          {runningCount > 0 && (
            <>
              <span className="convos-overview__stat-divider" />
              <span className="convos-overview__stat">
                <span className="convos-overview__stat-value text-green">{runningCount}</span>
                <span className="convos-overview__stat-label">running</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="overview-grid">
        {workflows.map((run) => {
          const badge = statusBadge[run.status] ?? { label: run.status.toUpperCase(), className: 'status-badge--unknown' };
          const cardStatus = run.status === 'running' ? 'active' : 'idle';

          return (
            <div
              key={run.runId}
              className={`overview-card overview-card--${cardStatus} cursor-pointer`}
              onClick={() => onSelect({ view: 'workflow', runId: run.runId, projectDir: run.projectDir, sessionId: run.sessionId })}
            >
              <div className="overview-card__header">
                <span className="font-bold flex items-center gap-2">
                  {run.status === 'running' && <span className="pulse-dot" />}
                  {run.workflowName}
                </span>
                <span className={`status-badge ${badge.className}`}>{badge.label}</span>
              </div>

              <div className="overview-card__meta text-xs text-muted">
                {run.projectName}
                <span className="text-cyan"> · {run.completedPhases}/{run.phases.length} phases</span>
                <span> · {run.agentCount} agents</span>
              </div>

              {run.summary && (
                <div className="text-xs text-muted" style={{ margin: '8px 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {run.summary}
                </div>
              )}

              <div className="convos-overview__agents">
                {run.agents.slice(0, 4).map((a) => (
                  <span key={a.agentId} className="convos-overview__agent-chip" title={a.agentType}>
                    {a.slug}
                  </span>
                ))}
                {run.agents.length > 4 && (
                  <span className="convos-overview__agent-chip convos-overview__agent-chip--more">
                    +{run.agents.length - 4}
                  </span>
                )}
              </div>

              <div className="overview-card__footer text-xs text-muted">
                {timeAgo(run.startTime)}
              </div>
            </div>
          );
        })}
      </div>

      {workflows.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ fontSize: 36 }}>⚙</div>
          <h2 className="empty-state__title">No workflows yet</h2>
          <p className="empty-state__text text-muted">
            Workflow runs will appear here when you run one (e.g. <code>/deep-research</code> or a custom workflow).
          </p>
        </div>
      )}
    </div>
  );
}
