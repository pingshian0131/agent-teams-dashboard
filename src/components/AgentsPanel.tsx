import { useState, useEffect } from 'react';
import type { TeamOverview, ViewSelection, AgentLogEntry, SidebarMode, ProjectOverview } from '../types';

interface AgentsPanelProps {
  team: TeamOverview | null;
  selectedProject: ProjectOverview | null;
  selection: ViewSelection;
  agentActivity: Map<string, AgentLogEntry[]>;
  onSelect: (sel: ViewSelection) => void;
  sidebarMode: SidebarMode;
  style?: React.CSSProperties;
}

interface AgentSession {
  sessionId: string;
  firstSeen: string;
  lastSeen: string;
  entryCount: number;
}

function getAgentSessions(entries: AgentLogEntry[]): AgentSession[] {
  const map = new Map<string, AgentSession>();
  for (const e of entries) {
    const existing = map.get(e.sessionId);
    if (existing) {
      if (e.timestamp < existing.firstSeen) existing.firstSeen = e.timestamp;
      if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
      existing.entryCount++;
    } else {
      map.set(e.sessionId, {
        sessionId: e.sessionId,
        firstSeen: e.timestamp,
        lastSeen: e.timestamp,
        entryCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
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

function getAgentStatus(entries: AgentLogEntry[]): AgentStatus {
  if (entries.length === 0) return 'unknown';
  const last = entries[entries.length - 1];
  const elapsed = Date.now() - new Date(last.timestamp).getTime();
  if (elapsed < 60_000) return 'active';
  return 'idle';
}

const agentStatusColors: Record<AgentStatus, string> = {
  active: 'var(--accent-green)',
  idle: 'var(--accent-yellow)',
  unknown: 'var(--text-muted)',
};

export default function AgentsPanel({ team, selectedProject, selection, agentActivity, onSelect, sidebarMode, style }: AgentsPanelProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const toggleAgent = (agentId: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
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

    return (
      <aside className="agents-panel" style={style}>
        <div className="agents-panel__header">
          <h2 className="agents-panel__title truncate">{selectedProject.projectName}</h2>
          <div className="agents-panel__task-summary text-xs text-muted">
            {selectedProject.agents.length} agent{selectedProject.agents.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="agents-panel__list">
          {selectedProject.agents.map((agent) => {
            const entries = agentActivity.get(agent.agentId) ?? [];
            const status = getAgentStatus(entries);
            const isSelected = selectedAgentId === agent.agentId;
            const isExpanded = expandedAgents.has(agent.agentId);
            const sessions = isExpanded ? getAgentSessions(entries) : [];
            const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;

            return (
              <div key={agent.agentId} className="agents-panel__agent">
                <button
                  className={`agents-panel__agent-btn ${isSelected ? 'agents-panel__agent-btn--active' : ''}`}
                  onClick={() =>
                    onSelect({
                      view: 'agent',
                      agentId: agent.agentId,
                      agentSlug: agent.slug,
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
                  {lastEntry && <span>{timeAgo(lastEntry.timestamp)}</span>}
                  {entries.length > 0 && (
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
                              sessionId: isSessionSelected ? undefined : s.sessionId,
                            });
                          }}
                        >
                          <span className="agents-panel__session-id">{s.sessionId.slice(0, 8)}</span>
                          <span className="agents-panel__session-time">
                            {formatTime(s.firstSeen)}–{formatTime(s.lastSeen)}
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
          const entries = agentActivity.get(member.agentId) ?? [];
          const status = getAgentStatus(entries);
          const isSelected = selectedAgentId === member.agentId;
          const isExpanded = expandedAgents.has(member.agentId);
          const sessions = isExpanded ? getAgentSessions(entries) : [];
          const lastEntry = entries[entries.length - 1];

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
                {lastEntry && <span>{timeAgo(lastEntry.timestamp)}</span>}
                {entries.length > 0 && (
                  <button
                    className="agents-panel__session-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAgent(member.agentId);
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
                          {formatTime(s.firstSeen)}–{formatTime(s.lastSeen)}
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
