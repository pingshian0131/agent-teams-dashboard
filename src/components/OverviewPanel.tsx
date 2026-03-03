import type { FullSnapshot, ViewSelection } from '../types';

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

export default function OverviewPanel({ snapshot, onSelect }: OverviewPanelProps) {
  const { teams } = snapshot;

  return (
    <div className="overview-panel">
      <h2 className="panel-title">Overview</h2>
      <div className="overview-grid">
        {teams.map((team) => {
          const { taskStats, config, lastActivity } = team;
          const pct = taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0;

          return (
            <div
              key={config.name}
              className="overview-card cursor-pointer"
              onClick={() => onSelect({ view: 'team', teamName: config.name })}
            >
              <div className="overview-card__header">
                <span className="font-bold">{config.name}</span>
                <span className="text-xs text-muted">{config.members.length} members</span>
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
