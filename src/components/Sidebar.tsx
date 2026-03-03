import { useState } from 'react';
import type { FullSnapshot, ViewSelection } from '../types';
import AgentItem from './AgentItem';

interface SidebarProps {
  snapshot: FullSnapshot | null;
  connected: boolean;
  selection: ViewSelection;
  onSelect: (sel: ViewSelection) => void;
}

export default function Sidebar({ snapshot, connected, selection, onSelect }: SidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (teamName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(teamName)) next.delete(teamName);
      else next.add(teamName);
      return next;
    });
  };

  const teams = snapshot?.teams ?? [];
  const totalStats = teams.reduce(
    (acc, t) => ({
      pending: acc.pending + t.taskStats.pending,
      inProgress: acc.inProgress + t.taskStats.inProgress,
      completed: acc.completed + t.taskStats.completed,
    }),
    { pending: 0, inProgress: 0, completed: 0 },
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="flex items-center justify-between">
          <h1 className="sidebar-title">Agent Teams</h1>
          <span title={connected ? 'Connected' : 'Disconnected'}>{connected ? '🟢' : '🔴'}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${selection.view === 'overview' ? 'sidebar-nav-item--active' : ''}`}
          onClick={() => onSelect({ view: 'overview' })}
        >
          Overview
        </button>

        {teams.length === 0 && (
          <div className="sidebar-empty text-muted text-sm" style={{ padding: '12px 8px' }}>
            No active teams
          </div>
        )}

        {teams.map((team) => {
          const name = team.config.name;
          const isExpanded = expanded.has(name);
          const isTeamSelected = selection.view === 'team' && selection.teamName === name;

          return (
            <div key={name} className="sidebar-team">
              <button
                className={`sidebar-team-header ${isTeamSelected ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => {
                  toggle(name);
                  onSelect({ view: 'team', teamName: name });
                }}
              >
                <span className="sidebar-team-arrow">{isExpanded ? '▾' : '▸'}</span>
                <span className="truncate">{name}</span>
                <span className="text-muted text-xs">{team.config.members.length}</span>
              </button>

              {isExpanded &&
                team.config.members.map((m) => {
                  const agentSlug = team.agentSlugs[m.agentId] ?? m.name;
                  const isAgentSelected =
                    selection.view === 'agent' && selection.agentId === m.agentId;

                  return (
                    <AgentItem
                      key={m.agentId}
                      member={m}
                      isSelected={isAgentSelected}
                      lastActivity={team.lastActivity}
                      onClick={() =>
                        onSelect({
                          view: 'agent',
                          agentId: m.agentId,
                          agentSlug,
                          teamName: name,
                        })
                      }
                    />
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-stats text-xs text-muted">
          <span>⏳ {totalStats.pending}</span>
          <span>🔄 {totalStats.inProgress}</span>
          <span>✅ {totalStats.completed}</span>
        </div>
      </div>
    </aside>
  );
}
