import { useState, useEffect } from 'react';
import type { ProjectOverview, ViewSelection } from '../types';

interface ConvosOverviewPanelProps {
  projects: ProjectOverview[];
  onSelect: (sel: ViewSelection) => void;
}

type ProjectStatus = 'active' | 'idle' | 'inactive';

function deriveStatus(project: ProjectOverview): ProjectStatus {
  if (!project.lastActivity) return 'inactive';
  const elapsed = Date.now() - new Date(project.lastActivity).getTime();
  if (elapsed < 60_000) return 'active';
  if (elapsed < 3_600_000) return 'idle';
  return 'inactive';
}

function timeAgo(ts: string): string {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const MM = String(d.getMinutes()).padStart(2, '0');
  if (d.getFullYear() !== new Date().getFullYear()) {
    return `${d.getFullYear()}-${mm}-${dd} ${HH}:${MM}`;
  }
  return `${mm}-${dd} ${HH}:${MM}`;
}

const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  active:   { label: 'ACTIVE',   className: 'status-badge--active' },
  idle:     { label: 'IDLE',     className: 'status-badge--idle' },
  inactive: { label: 'INACTIVE', className: 'status-badge--unknown' },
};

export default function ConvosOverviewPanel({ projects, onSelect }: ConvosOverviewPanelProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const totalAgents = projects.reduce((sum, p) => sum + p.agents.length, 0);
  const activeCount = projects.filter((p) => deriveStatus(p) === 'active').length;

  return (
    <div className="overview-panel">
      <div className="convos-overview__header">
        <h2 className="panel-title">Conversations</h2>
        <div className="convos-overview__stats">
          <span className="convos-overview__stat">
            <span className="convos-overview__stat-value">{projects.length}</span>
            <span className="convos-overview__stat-label">projects</span>
          </span>
          <span className="convos-overview__stat-divider" />
          <span className="convos-overview__stat">
            <span className="convos-overview__stat-value">{totalAgents}</span>
            <span className="convos-overview__stat-label">conversations</span>
          </span>
          {activeCount > 0 && (
            <>
              <span className="convos-overview__stat-divider" />
              <span className="convos-overview__stat">
                <span className="convos-overview__stat-value text-green">{activeCount}</span>
                <span className="convos-overview__stat-label">active</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="overview-grid">
        {projects.map((project) => {
          const status = deriveStatus(project);
          const badge = statusConfig[status];
          const agentCount = project.agents.length;
          const teamAgents = project.agents.filter((a) => a.agentId.includes('@'));
          const standaloneAgents = project.agents.filter((a) => !a.agentId.includes('@'));
          const teamNames = new Set(teamAgents.map((a) => a.agentId.split('@')[1]));

          return (
            <div
              key={project.projectDir}
              className={`overview-card overview-card--${status} cursor-pointer`}
              onClick={() => onSelect({ view: 'project', projectDir: project.projectDir })}
            >
              <div className="overview-card__header">
                <span className="font-bold flex items-center gap-2">
                  {status === 'active' && <span className="pulse-dot" />}
                  {project.projectName}
                </span>
                <span className={`status-badge ${badge.className}`}>{badge.label}</span>
              </div>

              <div className="overview-card__meta text-xs text-muted">
                {agentCount} conversation{agentCount !== 1 ? 's' : ''}
                {teamNames.size > 0 && (
                  <span className="text-cyan"> · {teamNames.size} team{teamNames.size !== 1 ? 's' : ''}</span>
                )}
                {standaloneAgents.length > 0 && teamAgents.length > 0 && (
                  <span> · {standaloneAgents.length} standalone</span>
                )}
              </div>

              <div className="convos-overview__agents">
                {project.agents.slice(0, 4).map((agent) => (
                  <span key={agent.agentId} className="convos-overview__agent-chip" title={agent.agentId}>
                    {agent.slug}
                  </span>
                ))}
                {agentCount > 4 && (
                  <span className="convos-overview__agent-chip convos-overview__agent-chip--more">
                    +{agentCount - 4}
                  </span>
                )}
              </div>

              <div className="overview-card__footer text-xs text-muted">
                {project.lastActivity ? timeAgo(project.lastActivity) : 'no activity'}
              </div>
            </div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ fontSize: 36 }}>~</div>
          <h2 className="empty-state__title">No conversations yet</h2>
          <p className="empty-state__text text-muted">
            Conversations will appear here when agents start working.
          </p>
        </div>
      )}
    </div>
  );
}
