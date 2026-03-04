import { useState, useEffect } from 'react';
import type { FullSnapshot, ViewSelection, TeamOverview } from '../types';

interface OverviewPanelProps {
  snapshot: FullSnapshot;
  onSelect: (sel: ViewSelection) => void;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

type TeamStatus = 'active' | 'idle' | 'done' | 'inactive';

function deriveStatus(team: TeamOverview): TeamStatus {
  const { lastActivity, taskStats } = team;
  if (!lastActivity) return 'inactive';
  const elapsed = Date.now() - new Date(lastActivity).getTime();
  if (taskStats.total > 0 && taskStats.completed === taskStats.total) return 'done';
  if (elapsed < 60_000) return 'active';
  return 'idle';
}

const statusConfig: Record<TeamStatus, { label: string; className: string }> = {
  active:   { label: 'ACTIVE',   className: 'status-badge--active' },
  idle:     { label: 'IDLE',     className: 'status-badge--idle' },
  done:     { label: 'DONE',     className: 'status-badge--done' },
  inactive: { label: 'INACTIVE', className: 'status-badge--unknown' },
};

export default function OverviewPanel({ snapshot, onSelect }: OverviewPanelProps) {
  const { teams } = snapshot;

  // Re-derive statuses every 10s so "active" → "idle" transitions happen without new data
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overview-panel">
      <h2 className="panel-title">Overview</h2>
      <div className="overview-grid">
        {teams.map((team) => {
          const { taskStats, config, lastActivity } = team;
          const pct = taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0;
          const status = deriveStatus(team);
          const badge = statusConfig[status];

          return (
            <div
              key={config.name}
              className={`overview-card overview-card--${status} cursor-pointer`}
              onClick={() => onSelect({ view: 'team', teamName: config.name })}
            >
              <div className="overview-card__header">
                <span className="font-bold flex items-center gap-2">
                  {status === 'active' && <span className="pulse-dot" />}
                  {config.name}
                </span>
                <span className={`status-badge ${badge.className}`}>{badge.label}</span>
              </div>

              <div className="overview-card__meta text-xs text-muted">
                {config.members.length} members
                {taskStats.inProgress > 0 && (
                  <span className="text-yellow"> · {taskStats.inProgress} in progress</span>
                )}
              </div>

              <div className="overview-card__progress">
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted">
                  {taskStats.completed}/{taskStats.total} tasks
                </span>
              </div>

              <div className="overview-card__footer text-xs text-muted">
                {lastActivity ? timeAgo(lastActivity) : 'no activity'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
