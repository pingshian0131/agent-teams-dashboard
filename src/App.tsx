import type { ViewSelection } from './types';
import { useState } from 'react';
import { useTeamsSocket } from './hooks/useTeamsSocket';
import Sidebar from './components/Sidebar';
import MainPanel from './components/MainPanel';

export default function App() {
  const { snapshot, connected, agentActivity } = useTeamsSocket();
  const [selection, setSelection] = useState<ViewSelection>({ view: 'overview' });

  return (
    <div className="app-container">
      <Sidebar
        snapshot={snapshot}
        connected={connected}
        selection={selection}
        onSelect={setSelection}
      />
      <MainPanel
        selection={selection}
        snapshot={snapshot}
        agentActivity={agentActivity}
        onSelect={setSelection}
      />
    </div>
  );
}
