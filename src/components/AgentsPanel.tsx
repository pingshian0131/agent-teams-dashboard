import { useState, useEffect } from 'react';
import type { TeamOverview, ViewSelection, SidebarMode, ProjectOverview, AgentSession } from '../types';

interface AgentsPanelProps {
  team: TeamOverview | null;
  selectedProject: ProjectOverview | null;
  selection: ViewSelection;
  onSelect: (sel: ViewSelection) => void;
  onModeChange?: (mode: SidebarMode) => void;
  sidebarMode: SidebarMode;
  style?: React.CSSProperties;
}

/** Extract team name from agentId like "name@team" or "team-lead@team" */
function parseTeamFromAgentId(agentId: string): string | null {
  const at = agentId.indexOf('@');
  if (at > 0) return agentId.slice(at + 1);
  return null;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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

type AgentStatus = 'active' | 'idle' | 'unknown';

function getAgentStatusFromTimestamp(lastTimestamp: string | undefined): AgentStatus {
  if (!lastTimestamp) return 'unknown';
  const elapsed = Date.now() - new Date(lastTimestamp).getTime();
  if (elapsed < 60_000) return 'active';
  return 'idle';
}

const agentStatusColors: Record<AgentStatus, string> = {
  active: 'var(--accent-green)',
  idle: 'var(--accent-yellow)',
  unknown: 'var(--text-muted)',
};

export default function AgentsPanel({ team, selectedProject, selection, onSelect, onModeChange, sidebarMode, style }: AgentsPanelProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [agentSessions, setAgentSessions] = useState<Map<string, AgentSession[]>>(new Map());

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const toggleAgent = (agentId: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
        // Fetch sessions when expanding
        if (!agentSessions.has(agentId)) {
          const authToken = localStorage.getItem('dashboard_auth_token');
          const headers: Record<string, string> = {};
          if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
          fetch(`/api/agents/${encodeURIComponent(agentId)}/sessions`, { headers })
            .then((r) => {
              if (r.status === 401) { window.dispatchEvent(new Event('auth-required')); return []; }
              return r.json();
            })
            .then((sessions: AgentSession[]) => {
              setAgentSessions((prev) => new Map(prev).set(agentId, sessions));
            })
            .catch(() => {});
        }
      }
      return next;
    });
  };

  // Conversations mode: show project agents
  if (sidebarMode === 'conversations') {
    if (!selectedProject) {
      return (
        <aside className="agents-panel" style={style}>
          <div className="agents-panel__header">
            <h2 className="agents-panel__title">Agents</h2>
          </div>
          <div className="agents-panel__empty">
            <span className="text-muted text-xs">Select a project</span>
          </div>
        </aside>
      );
    }

    const selectedAgentId = selection.view === 'agent' ? selection.agentId : null;

    // Group agents: team agents grouped under team header, standalone agents separate
    const teamGroups = new Map<string, typeof selectedProject.agents>();
    const standaloneAgents: typeof selectedProject.agents = [];
    for (const agent of selectedProject.agents) {
      const teamName = parseTeamFromAgentId(agent.agentId);
      if (teamName) {
        let group = teamGroups.get(teamName);
        if (!group) { group = []; teamGroups.set(teamName, group); }
        group.push(agent);
      } else {
        standaloneAgents.push(agent);
      }
    }

    const renderAgent = (agent: typeof selectedProject.agents[0], teamName?: string) => {
      const status = getAgentStatusFromTimestamp(agent.lastTimestamp);
      const isSelected = selectedAgentId === agent.agentId;
      const isExpanded = expandedAgents.has(agent.agentId);
      const sessions = isExpanded ? (agentSessions.get(agent.agentId) ?? []) : [];

      return (
        <div key={agent.agentId} className="agents-panel__agent">
          <button
            className={`agents-panel__agent-btn ${isSelected ? 'agents-panel__agent-btn--active' : ''}`}
            onClick={() =>
              onSelect({
                view: 'agent',
                agentId: agent.agentId,
                agentSlug: agent.slug,
                teamName,
              })
            }
          >
            <span className="agents-panel__agent-dot" style={{ color: agentStatusColors[status] }}>
              ●
            </span>
            <span className="agents-panel__agent-name truncate">{agent.slug}</span>
            <span className="agents-panel__agent-type text-xs text-muted">{agent.entryCount}</span>
          </button>

          <div className="agents-panel__agent-meta text-xs text-muted">
            {agent.lastTimestamp && <span>{timeAgo(agent.lastTimestamp)}</span>}
            {agent.entryCount > 0 && (
              <button
                className="agents-panel__session-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAgent(agent.agentId);
                }}
              >
                {isExpanded ? '▾' : '▸'} sessions
              </button>
            )}
          </div>

          {isExpanded && sessions.length > 0 && (
            <div className="agents-panel__sessions">
              {sessions.map((s) => {
                const isSessionSelected =
                  selection.view === 'agent' &&
                  selection.agentId === agent.agentId &&
                  selection.sessionId === s.sessionId;
                return (
                  <button
                    key={s.sessionId}
                    className={`agents-panel__session ${isSessionSelected ? 'agents-panel__session--active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({
                        view: 'agent',
                        agentId: agent.agentId,
                        agentSlug: agent.slug,
                        teamName,
                        sessionId: isSessionSelected ? undefined : s.sessionId,
                      });
                    }}
                  >
                    <span className="agents-panel__session-id">{s.sessionId.slice(0, 8)}</span>
                    <span className="agents-panel__session-time">
                      {formatTime(s.firstTimestamp)}–{formatTime(s.lastTimestamp)}
                    </span>
                    <span className="agents-panel__session-count">{s.entryCount}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    };

    return (
      <aside className="agents-panel" style={style}>
        <div className="agents-panel__header">
          <h2 className="agents-panel__title truncate">{selectedProject.projectName}</h2>
          <div className="agents-panel__task-summary text-xs text-muted">
            {selectedProject.agents.length} agent{selectedProject.agents.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="agents-panel__list">
          {/* Team groups */}
          {Array.from(teamGroups).map(([teamName, agents]) => (
            <div key={teamName} className="agents-panel__team-group">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  margin: '4px 0 2px',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                }}
              >
                <span style={{ color: 'var(--accent-cyan)' }}>⚑</span>
                <span className="truncate" style={{ flex: 1 }}>{teamName}</span>
                <span>{agents.length}</span>
              </div>
              {agents.map((a) => renderAgent(a, teamName))}
            </div>
          ))}
          {/* Standalone agents */}
          {standaloneAgents.map((a) => renderAgent(a))}
        </div>
      </aside>
    );
  }

  if (!team) {
    return (
      <aside className="agents-panel" style={style}>
        <div className="agents-panel__header">
          <h2 className="agents-panel__title">Agents</h2>
        </div>
        <div className="agents-panel__empty">
          <span className="text-muted text-xs">Select a team</span>
        </div>
      </aside>
    );
  }

  const selectedAgentId = selection.view === 'agent' ? selection.agentId : null;
  const isTasksView = selection.view === 'tasks' && selection.teamName === team.config.name;
  const { taskStats } = team;

  return (
    <aside className="agents-panel" style={style}>
      <div className="agents-panel__header">
        <h2 className="agents-panel__title truncate">{team.config.name}</h2>
        <div className="agents-panel__task-summary text-xs text-muted">
          {taskStats.completed}/{taskStats.total} tasks
        </div>
      </div>

      <div className="agents-panel__actions">
        <button
          className={`agents-panel__tasks-btn ${isTasksView ? 'agents-panel__tasks-btn--active' : ''}`}
          onClick={() => onSelect({ view: 'tasks', teamName: team.config.name })}
        >
          ☰ Task Board
        </button>
      </div>

      <div className="agents-panel__list">
        {team.config.members.map((member) => {
          const agentSlug = team.agentSlugs[member.agentId] ?? member.name;
          const isSelected = selectedAgentId === member.agentId;
          const isExpanded = expandedAgents.has(member.agentId);
          const sessions = isExpanded ? (agentSessions.get(member.agentId) ?? []) : [];
          // Use team lastActivity as rough proxy; individual agent timestamps
          // are available from the snapshot's project overview but not directly here.
          // The status dot will update when the user views the agent detail.
          const status: AgentStatus = team.lastActivity
            ? getAgentStatusFromTimestamp(team.lastActivity)
            : 'unknown';

          return (
            <div key={member.agentId} className="agents-panel__agent">
              <button
                className={`agents-panel__agent-btn ${isSelected ? 'agents-panel__agent-btn--active' : ''}`}
                onClick={() =>
                  onSelect({
                    view: 'agent',
                    agentId: member.agentId,
                    agentSlug,
                    teamName: team.config.name,
                  })
                }
              >
                <span className="agents-panel__agent-dot" style={{ color: agentStatusColors[status] }}>
                  ●
                </span>
                <span className="agents-panel__agent-name truncate">{member.name}</span>
                <span className="agents-panel__agent-type text-xs text-muted">{member.agentType}</span>
              </button>

              <div className="agents-panel__agent-meta text-xs text-muted">
                {team.lastActivity && <span>{timeAgo(team.lastActivity)}</span>}
                <button
                  className="agents-panel__session-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAgent(member.agentId);
                  }}
                >
                  {isExpanded ? '▾' : '▸'} sessions
                </button>
              </div>

              {isExpanded && sessions.length > 0 && (
                <div className="agents-panel__sessions">
                  {sessions.map((s) => {
                    const isSessionSelected =
                      selection.view === 'agent' &&
                      selection.agentId === member.agentId &&
                      selection.sessionId === s.sessionId;
                    return (
                      <button
                        key={s.sessionId}
                        className={`agents-panel__session ${isSessionSelected ? 'agents-panel__session--active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect({
                            view: 'agent',
                            agentId: member.agentId,
                            agentSlug,
                            teamName: team.config.name,
                            sessionId: isSessionSelected ? undefined : s.sessionId,
                          });
                        }}
                      >
                        <span className="agents-panel__session-id">{s.sessionId.slice(0, 8)}</span>
                        <span className="agents-panel__session-time">
                          {formatTime(s.firstTimestamp)}–{formatTime(s.lastTimestamp)}
                        </span>
                        <span className="agents-panel__session-count">{s.entryCount}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
