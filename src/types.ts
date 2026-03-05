// Team & Members
export interface TeamMember {
  name: string;
  agentId: string;
  agentType: string;
}

export interface TeamConfig {
  name: string;
  members: TeamMember[];
}

// Tasks
export interface TeamTask {
  id: string;
  subject: string;
  description: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  blocks: string[];
  blockedBy: string[];
  owner?: string;
}

// Agent Activity
export interface AgentLogEntry {
  agentId: string;
  slug: string;
  sessionId: string;
  type: 'user' | 'assistant';
  message: {
    role: string;
    content: MessageContent[];
    model?: string;
  };
  timestamp: string;
  projectDir?: string;
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

// Agent Sessions
export interface AgentSession {
  sessionId: string;
  agentId: string;
  slug: string;
  entryCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
}

// Project overview (for Convos mode)
export interface ProjectOverview {
  projectDir: string;
  projectName: string;
  agents: { agentId: string; slug: string; entryCount: number; lastTimestamp: string }[];
  lastActivity: string;
}

// Aggregated types
export interface TeamOverview {
  config: TeamConfig;
  tasks: TeamTask[];
  taskStats: { total: number; pending: number; inProgress: number; completed: number };
  agentSlugs: Record<string, string>;
  lastActivity: string;
}

export interface FullSnapshot {
  teams: TeamOverview[];
  unmatchedAgents: { agentId: string; slug: string; sessionId: string }[];
  agentActivity: Record<string, AgentLogEntry[]>;
  projects: ProjectOverview[];
}

// WebSocket events
export type WsEvent =
  | { type: 'snapshot'; data: FullSnapshot }
  | { type: 'tasks_updated'; teamId: string; tasks: TeamTask[] }
  | { type: 'team_updated'; team: TeamOverview }
  | { type: 'team_removed'; teamId: string }
  | { type: 'agent_activity'; agentId: string; entries: AgentLogEntry[] };

// Sidebar mode
export type SidebarMode = 'teams' | 'conversations';

// UI state
export type ViewSelection =
  | { view: 'overview' }
  | { view: 'team'; teamName: string }
  | { view: 'agent'; agentId: string; agentSlug: string; teamName?: string; sessionId?: string }
  | { view: 'tasks'; teamName: string }
  | { view: 'project'; projectDir: string };
