import type { ViewSelection, SidebarMode } from './types';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTeamsSocket } from './hooks/useTeamsSocket';
import { useAuth } from './hooks/useAuth';
import { useResponsive } from './hooks/useResponsive';
import Sidebar from './components/Sidebar';
import AgentsPanel from './components/AgentsPanel';
import MainPanel from './components/MainPanel';
import LoginScreen from './components/LoginScreen';

const COLLAPSED_WIDTH = 88;

type DrawerOpen = 'teams' | 'agents' | null;

function useResizable(initial: number, min: number, max: number, enabled = true) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width, enabled]);

  useEffect(() => {
    if (!enabled) return;
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
  }, [min, max, enabled]);

  return { width, onMouseDown };
}

export default function App() {
  const { token, needsAuth, setToken } = useAuth();
  const { snapshot, connected, lastUpdated } = useTeamsSocket(token);
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [selection, setSelection] = useState<ViewSelection>({ view: 'project', projectDir: '' });
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [sidebarMode, _setSidebarMode] = useState<SidebarMode>('conversations');
  const [drawerOpen, setDrawerOpen] = useState<DrawerOpen>(null);
  const handleModeChange = useCallback((mode: SidebarMode) => {
    _setSidebarMode(mode);
    if (mode === 'conversations') {
      setSelection({ view: 'project', projectDir: '' });
    } else if (mode === 'teams') {
      setSelection({ view: 'overview' });
    }
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const handleCollapseChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, []);

  // On mobile, resize is disabled; on tablet, panel1 is forced collapsed
  const panel1 = useResizable(260, 120, 400, isDesktop);
  const panel2 = useResizable(isTablet ? 200 : 260, 160, 500, !isMobile);

  const handleSelect = useCallback((sel: ViewSelection) => {
    setSelection(sel);
    if (sel.view === 'team' || sel.view === 'tasks') setSelectedTeam(sel.teamName);
    else if (sel.view === 'agent' && sel.teamName) setSelectedTeam(sel.teamName);
    if (sel.view === 'project') setSelectedProject(sel.projectDir);
  }, []);

  // On mobile, selecting an item also closes the drawer
  const handleMobileSelect = useCallback((sel: ViewSelection) => {
    handleSelect(sel);
    if (isMobile) setDrawerOpen(null);
  }, [handleSelect, isMobile]);

  // Close drawer when switching from mobile to larger breakpoint
  useEffect(() => {
    if (!isMobile) setDrawerOpen(null);
  }, [isMobile]);

  // Tablet: force sidebar collapsed
  const effectiveCollapsed = isMobile || isTablet ? true : sidebarCollapsed;

  const team = selectedTeam
    ? snapshot?.teams.find((t) => t.config.name === selectedTeam) ?? null
    : null;

  const project = selectedProject
    ? snapshot?.projects?.find((p) => p.projectDir === selectedProject) ?? null
    : null;

  if (needsAuth) {
    return <LoginScreen onSubmit={setToken} />;
  }

  // --- Mobile layout ---
  if (isMobile) {
    return (
      <div className="app-container app-container--mobile">
        <header className="mobile-header">
          <button
            className="mobile-header__menu-btn"
            onClick={() => setDrawerOpen(drawerOpen === 'teams' ? null : 'teams')}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="mobile-header__title truncate">
            {selection.view === 'agent' && selection.agentSlug
              ? selection.agentSlug
              : selection.view === 'team' && selection.teamName
                ? selection.teamName
                : selection.view === 'project'
                  ? 'Conversations'
                  : selection.view === 'overview'
                    ? 'Overview'
                    : 'Dashboard'}
          </span>
          <span
            className="mobile-header__conn-dot"
            style={{ color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }}
          >
            ●
          </span>
        </header>

        {/* Drawer backdrop */}
        {drawerOpen && (
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(null)} />
        )}

        {/* Teams drawer */}
        <Sidebar
          snapshot={snapshot}
          connected={connected}
          lastUpdated={lastUpdated}
          selection={selection}
          selectedTeam={selectedTeam}
          selectedProject={selectedProject}
          onSelect={(sel) => {
            handleMobileSelect(sel);
            // If selecting a team/project, briefly show agents drawer
            if (sel.view === 'team' || sel.view === 'project') {
              setDrawerOpen('agents');
            }
          }}
          sidebarMode={sidebarMode}
          onModeChange={handleModeChange}
          isCollapsed={false}
          onCollapseChange={() => {}}
          className={drawerOpen === 'teams' ? 'teams-panel--drawer-open' : ''}
        />

        {/* Agents drawer */}
        <AgentsPanel
          team={team}
          selectedProject={project}
          selection={selection}
          onSelect={handleMobileSelect}
          onModeChange={handleModeChange}
          sidebarMode={sidebarMode}
          className={drawerOpen === 'agents' ? 'agents-panel--drawer-open' : ''}
        />

        <MainPanel
          selection={selection}
          snapshot={snapshot}
          onSelect={handleSelect}
          sidebarMode={sidebarMode}
          selectedProject={selectedProject}
        />

        <nav className="mobile-tab-bar">
          <button
            className={`mobile-tab-bar__tab ${drawerOpen === 'teams' ? 'mobile-tab-bar__tab--active' : ''}`}
            onClick={() => setDrawerOpen(drawerOpen === 'teams' ? null : 'teams')}
          >
            <span className="mobile-tab-bar__icon">◈</span>
            <span className="mobile-tab-bar__label">
              {sidebarMode === 'teams' ? 'Teams' : 'Projects'}
            </span>
          </button>
          <button
            className={`mobile-tab-bar__tab ${drawerOpen === 'agents' ? 'mobile-tab-bar__tab--active' : ''}`}
            onClick={() => setDrawerOpen(drawerOpen === 'agents' ? null : 'agents')}
          >
            <span className="mobile-tab-bar__icon">◉</span>
            <span className="mobile-tab-bar__label">Agents</span>
          </button>
          <button
            className={`mobile-tab-bar__tab ${!drawerOpen ? 'mobile-tab-bar__tab--active' : ''}`}
            onClick={() => setDrawerOpen(null)}
          >
            <span className="mobile-tab-bar__icon">▤</span>
            <span className="mobile-tab-bar__label">Content</span>
          </button>
        </nav>
      </div>
    );
  }

  // --- Tablet & Desktop layout ---
  return (
    <div className={`app-container ${isTablet ? 'app-container--tablet' : ''}`}>
      <Sidebar
        snapshot={snapshot}
        connected={connected}
        lastUpdated={lastUpdated}
        selection={selection}
        selectedTeam={selectedTeam}
        selectedProject={selectedProject}
        onSelect={handleSelect}
        sidebarMode={sidebarMode}
        onModeChange={handleModeChange}
        isCollapsed={effectiveCollapsed}
        onCollapseChange={handleCollapseChange}
        style={effectiveCollapsed
          ? { width: COLLAPSED_WIDTH, minWidth: COLLAPSED_WIDTH }
          : { width: panel1.width, minWidth: panel1.width }
        }
      />
      {!effectiveCollapsed && (
        <div className="resize-handle" onMouseDown={panel1.onMouseDown} />
      )}
      <AgentsPanel
        team={team}
        selectedProject={project}
        selection={selection}
        onSelect={handleSelect}
        onModeChange={handleModeChange}
        sidebarMode={sidebarMode}
        style={isTablet
          ? { width: 200, minWidth: 160 }
          : { width: panel2.width, minWidth: panel2.width }
        }
      />
      {!isTablet && (
        <div className="resize-handle" onMouseDown={panel2.onMouseDown} />
      )}
      <MainPanel
        selection={selection}
        snapshot={snapshot}
        onSelect={handleSelect}
        sidebarMode={sidebarMode}
        selectedProject={selectedProject}
      />
    </div>
  );
}
