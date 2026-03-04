import type { ViewSelection } from './types';
import { useState, useCallback } from 'react';
import { useTeamsSocket } from './hooks/useTeamsSocket';
import Sidebar from './components/Sidebar';
import AgentsPanel from './components/AgentsPanel';
import MainPanel from './components/MainPanel';

export default function App() {
  const { snapshot, connected, agentActivity, lastUpdated } = useTeamsSocket();
  const [selection, setSelection] = useState<ViewSelection>({ view: 'overview' });
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const handleSelect = useCallback((sel: ViewSelection) => {
    setSelection(sel);
    if (sel.view === 'team' || sel.view === 'tasks') setSelectedTeam(sel.teamName);
    else if (sel.view === 'agent' && sel.teamName) setSelectedTeam(sel.teamName);
  }, []);

  const team = selectedTeam
    ? snapshot?.teams.find((t) => t.config.name === selectedTeam) ?? null
    : null;

  return (
    <div className="app-container">
      <Sidebar
        snapshot={snapshot}
        connected={connected}
        lastUpdated={lastUpdated}
        selection={selection}
        selectedTeam={selectedTeam}
        onSelect={handleSelect}
      />
      <AgentsPanel
        team={team}
        selection={selection}
        agentActivity={agentActivity}
        onSelect={handleSelect}
      />
      <MainPanel
        selection={selection}
        snapshot={snapshot}
        agentActivity={agentActivity}
        onSelect={handleSelect}
      />
    </div>
  );
}
