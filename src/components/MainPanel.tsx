import type { FullSnapshot, ViewSelection, SidebarMode } from '../types';
import OverviewPanel from './OverviewPanel';
import ConvosOverviewPanel from './ConvosOverviewPanel';
import AgentPanel from './AgentPanel';
import TaskBoard from './TaskBoard';
import EmptyState from './EmptyState';
import SearchResults from './SearchResults';
import SearchBar from './SearchBar';

interface MainPanelProps {
  selection: ViewSelection;
  snapshot: FullSnapshot | null;
  onSelect: (sel: ViewSelection) => void;
  sidebarMode: SidebarMode;
  selectedProject: string | null;
}

export default function MainPanel({ selection, snapshot, onSelect, sidebarMode, selectedProject }: MainPanelProps) {
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

      case 'search':
        return (
          <SearchResults
            query={selection.query}
            projectDir={selection.projectDir}
            projects={snapshot.projects ?? []}
            onSelect={onSelect}
          />
        );

      case 'project':
        return <ConvosOverviewPanel projects={snapshot.projects ?? []} onSelect={onSelect} />;

      default:
        return <EmptyState />;
    }
  };

  return (
    <main className="main-panel">
      {sidebarMode === 'conversations' && (
        <SearchBar
          projects={snapshot.projects ?? []}
          selectedProject={selectedProject ?? undefined}
          onSearch={onSelect}
        />
      )}
      {renderContent()}
    </main>
  );
}
