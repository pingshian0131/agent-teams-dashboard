import type { ViewSelection, SidebarMode } from './types';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTeamsSocket } from './hooks/useTeamsSocket';
import Sidebar from './components/Sidebar';
import AgentsPanel from './components/AgentsPanel';
import MainPanel from './components/MainPanel';

function useResizable(initial: number, min: number, max: number) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      setWidth(Math.max(min, Math.min(max, startW.current + delta)));
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [min, max]);

  return { width, onMouseDown };
}

export default function App() {
  const { snapshot, connected, agentActivity, lastUpdated } = useTeamsSocket();
  const [selection, setSelection] = useState<ViewSelection>({ view: 'overview' });
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('teams');

  const panel1 = useResizable(200, 120, 400);
  const panel2 = useResizable(260, 160, 500);

  const handleSelect = useCallback((sel: ViewSelection) => {
    setSelection(sel);
    if (sel.view === 'team' || sel.view === 'tasks') setSelectedTeam(sel.teamName);
    else if (sel.view === 'agent' && sel.teamName) setSelectedTeam(sel.teamName);
    if (sel.view === 'project') setSelectedProject(sel.projectDir);
  }, []);

  const team = selectedTeam
    ? snapshot?.teams.find((t) => t.config.name === selectedTeam) ?? null
    : null;

  const project = selectedProject
    ? snapshot?.projects?.find((p) => p.projectDir === selectedProject) ?? null
    : null;

  return (
    <div className="app-container">
      <Sidebar
        snapshot={snapshot}
        connected={connected}
        lastUpdated={lastUpdated}
        selection={selection}
        selectedTeam={selectedTeam}
        selectedProject={selectedProject}
        onSelect={handleSelect}
        sidebarMode={sidebarMode}
        onModeChange={setSidebarMode}
        agentActivity={agentActivity}
        style={{ width: panel1.width, minWidth: panel1.width }}
      />
      <div className="resize-handle" onMouseDown={panel1.onMouseDown} />
      <AgentsPanel
        team={team}
        selectedProject={project}
        selection={selection}
        agentActivity={agentActivity}
        onSelect={handleSelect}
        sidebarMode={sidebarMode}
        style={{ width: panel2.width, minWidth: panel2.width }}
      />
      <div className="resize-handle" onMouseDown={panel2.onMouseDown} />
      <MainPanel
        selection={selection}
        snapshot={snapshot}
        agentActivity={agentActivity}
        onSelect={handleSelect}
      />
    </div>
  );
}
