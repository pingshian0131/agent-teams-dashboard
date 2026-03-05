import type { FullSnapshot, ViewSelection } from '../types';
import OverviewPanel from './OverviewPanel';
import AgentPanel from './AgentPanel';
import TaskBoard from './TaskBoard';
import EmptyState from './EmptyState';

interface MainPanelProps {
  selection: ViewSelection;
  snapshot: FullSnapshot | null;
  onSelect: (sel: ViewSelection) => void;
}

export default function MainPanel({ selection, snapshot, onSelect }: MainPanelProps) {
  if (!snapshot) {
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

      case 'agent':
        return (
          <AgentPanel
            agentId={selection.agentId}
            agentSlug={selection.agentSlug}
            teamName={selection.teamName}
            sessionId={selection.sessionId}
          />
        );

      case 'tasks': {
        const team = snapshot.teams.find((t) => t.config.name === selection.teamName);
        if (!team) return <EmptyState />;
        return <TaskBoard tasks={team.tasks} teamName={selection.teamName} />;
      }

      case 'project':
        return <EmptyState />;

      default:
        return <EmptyState />;
    }
  };

  return <main className="main-panel">{renderContent()}</main>;
}
