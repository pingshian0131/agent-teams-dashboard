import type { FullSnapshot, ViewSelection, AgentLogEntry } from '../types';
import OverviewPanel from './OverviewPanel';
import AgentPanel from './AgentPanel';
import TaskBoard from './TaskBoard';
import EmptyState from './EmptyState';

interface MainPanelProps {
  selection: ViewSelection;
  snapshot: FullSnapshot | null;
  agentActivity: Map<string, AgentLogEntry[]>;
  onSelect: (sel: ViewSelection) => void;
}

export default function MainPanel({ selection, snapshot, agentActivity, onSelect }: MainPanelProps) {
  if (!snapshot || snapshot.teams.length === 0) {
    return (
      <main className="main-panel">
        <EmptyState />
      </main>
    );
  }

  const renderContent = () => {
    switch (selection.view) {
      case 'overview':
        return <OverviewPanel snapshot={snapshot} onSelect={onSelect} />;

      case 'team': {
        const team = snapshot.teams.find((t) => t.config.name === selection.teamName);
        if (!team) return <EmptyState />;
        return <TaskBoard tasks={team.tasks} teamName={selection.teamName} />;
      }

      case 'agent': {
        const entries = agentActivity.get(selection.agentId) ?? [];
        const team = snapshot.teams.find((t) => t.config.name === selection.teamName);
        return (
          <AgentPanel
            agentId={selection.agentId}
            agentSlug={selection.agentSlug}
            entries={entries}
            teamName={selection.teamName}
            tasks={team?.tasks}
          />
        );
      }

      case 'tasks': {
        const team = snapshot.teams.find((t) => t.config.name === selection.teamName);
        if (!team) return <EmptyState />;
        return <TaskBoard tasks={team.tasks} teamName={selection.teamName} />;
      }

      default:
        return <EmptyState />;
    }
  };

  return <main className="main-panel">{renderContent()}</main>;
}
