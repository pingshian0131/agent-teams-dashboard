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
  realPath: string;
  agents: {
    agentId: string;
    slug: string;
    entryCount: number;
    lastTimestamp: string;
    // Present when this agent was spawned by a workflow run (Convos shows a ⚙ marker)
    workflowRunId?: string;
    workflowName?: string;
  }[];
  lastActivity: string;
}

// Workflows
export interface WorkflowAgentRef {
  agentId: string;       // namespaced as "wf:<runId>:<hash>"
  agentType: string;     // from agent-<hash>.meta.json (e.g. "Explore", "workflow-subagent")
  slug: string;
  entryCount: number;
  lastTimestamp: string;
}

export interface WorkflowRun {
  runId: string;
  workflowName: string;
  summary: string;
  status: string; // 'running' | 'completed' | 'failed' | ...
  startTime: number;
  durationMs?: number;
  timestamp: string;
  agentCount: number;
  totalTokens?: number;
  totalToolCalls?: number;
  defaultModel?: string;
  phases: { title: string; detail?: string }[];
  completedPhases: number;
  projectDir: string;
  projectName: string;
  sessionId: string;
  agents: WorkflowAgentRef[];
  // detail-only fields (returned by GET /api/workflows/:runId, omitted from snapshots)
  script?: string;
  scriptPath?: string;
  result?: unknown;
  logs?: unknown[];
}

// Aggregated types
export interface TeamOverview {
  config: TeamConfig;
  tasks: TeamTask[];
  taskStats: { total: number; pending: number; inProgress: number; completed: number };
  agentSlugs: Record<string, string>;
  lastActivity: string;
  removedAt?: string;
}

export interface FullSnapshot {
  teams: TeamOverview[];
  unmatchedAgents: { agentId: string; slug: string; sessionId: string }[];
  agentActivity?: Record<string, AgentLogEntry[]>;
  projects: ProjectOverview[];
  workflows: WorkflowRun[];
}

// WebSocket events
export type WsEvent =
  | { type: 'snapshot'; data: FullSnapshot }
  | { type: 'tasks_updated'; teamId: string; tasks: TeamTask[] }
  | { type: 'team_updated'; team: TeamOverview }
  | { type: 'team_removed'; teamId: string }
  | { type: 'agent_activity'; agentId: string; entries: AgentLogEntry[] }
  | { type: 'agent_entries_delta'; agentId: string; entries: AgentLogEntry[] };

// Sidebar mode
export type SidebarMode = 'teams' | 'conversations' | 'workflows';

// Search
export interface SearchResult {
  agentId: string;
  slug: string;
  sessionId: string;
  projectDir: string;
  timestamp: string;
  type: 'user' | 'assistant';
  snippet: string;
  matchField: 'text' | 'tool_use' | 'tool_result';
}

// UI state
export type ViewSelection =
  | { view: 'overview' }
  | { view: 'team'; teamName: string }
  | { view: 'agent'; agentId: string; agentSlug: string; teamName?: string; sessionId?: string; projectDir?: string }
  | { view: 'tasks'; teamName: string }
  | { view: 'project'; projectDir: string }
  | { view: 'workflows'; projectDir?: string }
  | { view: 'workflow'; runId: string; projectDir: string; sessionId?: string }
  | { view: 'search'; query: string; projectDir?: string };
