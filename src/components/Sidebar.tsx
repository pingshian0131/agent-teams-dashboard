import { useState, useEffect } from 'react';
import type { FullSnapshot, ViewSelection, TeamOverview } from '../types';

interface SidebarProps {
  snapshot: FullSnapshot | null;
  connected: boolean;
  lastUpdated: number | null;
  selection: ViewSelection;
  selectedTeam: string | null;
  onSelect: (sel: ViewSelection) => void;
}

const REFRESH_INTERVAL = 5;

function useRefreshCountdown(lastUpdated: number | null): number | null {
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (lastUpdated === null) return;
    const calc = () => {
      const elapsed = (Date.now() - lastUpdated) / 1000;
      return Math.max(0, REFRESH_INTERVAL - Math.floor(elapsed % REFRESH_INTERVAL));
    };
    setCountdown(calc());
    const id = setInterval(() => setCountdown(calc()), 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);
  return countdown;
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

const statusColors: Record<TeamStatus, string> = {
  active: 'var(--accent-green)',
  idle: 'var(--accent-yellow)',
  done: 'var(--accent-cyan)',
  inactive: 'var(--text-muted)',
};

export default function Sidebar({ snapshot, connected, lastUpdated, selection, selectedTeam, onSelect }: SidebarProps) {
  const teams = snapshot?.teams ?? [];
  const totalStats = teams.reduce(
    (acc, t) => ({
      pending: acc.pending + t.taskStats.pending,
      inProgress: acc.inProgress + t.taskStats.inProgress,
      completed: acc.completed + t.taskStats.completed,
    }),
    { pending: 0, inProgress: 0, completed: 0 },
  );

  const countdown = useRefreshCountdown(lastUpdated);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className="teams-panel">
      <div className="teams-panel__header">
        <div className="flex items-center justify-between">
          <h1 className="teams-panel__title">Teams</h1>
          <span className="flex items-center gap-2">
            {countdown !== null && (
              <span className="text-xs text-muted" title="Next refresh">
                {countdown}s
              </span>
            )}
            <span
              className="teams-panel__conn-dot"
              style={{ color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }}
              title={connected ? 'Connected' : 'Disconnected'}
            >
              ●
            </span>
          </span>
        </div>
      </div>

      <nav className="teams-panel__nav">
        <button
          className={`teams-panel__nav-item ${selection.view === 'overview' ? 'teams-panel__nav-item--active' : ''}`}
          onClick={() => onSelect({ view: 'overview' })}
        >
          <span className="teams-panel__nav-icon">◈</span>
          <span>Overview</span>
        </button>

        <div className="teams-panel__divider" />

        {teams.length === 0 && (
          <div className="text-muted text-xs" style={{ padding: '12px 8px' }}>
            No active teams
          </div>
        )}

        {teams.map((team) => {
          const name = team.config.name;
          const status = deriveStatus(team);
          const isSelected = selectedTeam === name;
          const { taskStats } = team;
          const pct = taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0;

          return (
            <button
              key={name}
              className={`teams-panel__team ${isSelected ? 'teams-panel__team--active' : ''}`}
              onClick={() => onSelect({ view: 'team', teamName: name })}
            >
              <div className="teams-panel__team-row">
                <span className="teams-panel__team-dot" style={{ color: statusColors[status] }}>
                  {status === 'active' ? '◉' : '●'}
                </span>
                <span className="teams-panel__team-name truncate">{name}</span>
                <span className="text-xs text-muted">{team.config.members.length}</span>
              </div>
              <div className="teams-panel__team-progress">
                <div className="teams-panel__team-bar">
                  <div className="teams-panel__team-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="teams-panel__team-pct text-xs text-muted">
                  {taskStats.completed}/{taskStats.total}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="teams-panel__footer">
        <div className="teams-panel__footer-stats text-xs text-muted">
          <span title="Pending">⏳ {totalStats.pending}</span>
          <span title="In Progress">⚡ {totalStats.inProgress}</span>
          <span title="Completed">✓ {totalStats.completed}</span>
        </div>
      </div>
    </aside>
  );
}
