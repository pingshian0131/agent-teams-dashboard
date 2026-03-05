import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { EventEmitter } from 'node:events';
import type {
  TeamConfig,
  TeamMember,
  TeamTask,
  TeamOverview,
  FullSnapshot,
  AgentLogEntry,
  AgentSession,
} from '../src/types.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const TEAMS_DIR = join(CLAUDE_DIR, 'teams');
const TASKS_DIR = join(CLAUDE_DIR, 'tasks');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const MAX_ENTRIES_PER_AGENT = 200;

// In-memory caches
const teams = new Map<string, TeamConfig>();
const tasks = new Map<string, TeamTask[]>();
const agentEntries = new Map<string, AgentLogEntry[]>();
const agentOffsets = new Map<string, number>();
const teamFileMtimes = new Map<string, number>(); // team name -> latest mtime (ms)

export const onChange = new EventEmitter();

// --- Helpers ---

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function safeFileStat(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

// --- Teams ---

export async function refreshTeams(): Promise<void> {
  const teamDirs = await safeReaddir(TEAMS_DIR);
  const currentNames = new Set<string>();

  for (const dir of teamDirs) {
    const configPath = join(TEAMS_DIR, dir, 'config.json');
    const raw = await safeReadFile(configPath);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const config: TeamConfig = {
        name: parsed.name ?? dir,
        members: Array.isArray(parsed.members)
          ? parsed.members.map((m: any): TeamMember => ({
              name: m.name ?? '',
              agentId: m.agentId ?? '',
              agentType: m.agentType ?? '',
            }))
          : [],
      };
      teams.set(config.name, config);
      currentNames.add(config.name);

      // Track config file mtime
      const configStat = await safeFileStat(configPath);
      if (configStat) {
        const prev = teamFileMtimes.get(config.name) ?? 0;
        if (configStat.mtimeMs > prev) {
          teamFileMtimes.set(config.name, configStat.mtimeMs);
        }
      }
    } catch {
      // skip malformed config
    }
  }

  // Remove teams that no longer exist on disk
  for (const name of teams.keys()) {
    if (!currentNames.has(name)) {
      teams.delete(name);
      teamFileMtimes.delete(name);
    }
  }
}

// --- Tasks ---

export async function refreshTasks(teamId: string): Promise<void> {
  const taskDir = join(TASKS_DIR, teamId);
  const files = await safeReaddir(taskDir);
  const teamTasks: TeamTask[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = join(taskDir, file);
    const raw = await safeReadFile(filePath);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      teamTasks.push({
        id: String(parsed.id ?? ''),
        subject: parsed.subject ?? '',
        description: parsed.description ?? '',
        activeForm: parsed.activeForm ?? '',
        status: parsed.status ?? 'pending',
        blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
        blockedBy: Array.isArray(parsed.blockedBy) ? parsed.blockedBy : [],
        owner: parsed.owner,
      });

      // Track task file mtime for lastActivity
      const taskStat = await safeFileStat(filePath);
      if (taskStat) {
        const prev = teamFileMtimes.get(teamId) ?? 0;
        if (taskStat.mtimeMs > prev) {
          teamFileMtimes.set(teamId, taskStat.mtimeMs);
        }
      }
    } catch {
      // skip malformed task
    }
  }

  // Sort by numeric id
  teamTasks.sort((a, b) => Number(a.id) - Number(b.id));
  tasks.set(teamId, teamTasks);
}

async function refreshAllTasks(): Promise<void> {
  // Refresh tasks for known teams
  for (const name of teams.keys()) {
    await refreshTasks(name);
  }
  // Also check tasks dir for any team dirs not yet in teams map
  const taskDirs = await safeReaddir(TASKS_DIR);
  for (const dir of taskDirs) {
    if (!tasks.has(dir)) {
      await refreshTasks(dir);
    }
  }
}

// --- Agent JSONL scanning ---

// Scan both subagent JSONL (agent-*.jsonl) and team session JSONL (UUID.jsonl with teamName)
export async function scanAgentJsonl(): Promise<void> {
  const projectDirs = await safeReaddir(PROJECTS_DIR);

  for (const projDir of projectDirs) {
    const projPath = join(PROJECTS_DIR, projDir);
    const entries = await safeReaddir(projPath);

    for (const entry of entries) {
      const entryPath = join(projPath, entry);

      // Team session JSONL: UUID.jsonl files at project root level
      if (entry.endsWith('.jsonl')) {
        await readNewEntries(entryPath, true);
        continue;
      }

      // Subagent JSONL: agent-*.jsonl under session/subagents/
      const subagentsDir = join(entryPath, 'subagents');
      const files = await safeReaddir(subagentsDir);
      for (const file of files) {
        if (!file.startsWith('agent-') || !file.endsWith('.jsonl')) continue;
        await readNewEntries(join(subagentsDir, file), false);
      }
    }
  }
}

async function readNewEntries(filePath: string, isSessionFile: boolean): Promise<void> {
  const fileStat = await safeFileStat(filePath);
  if (!fileStat) return;

  const currentOffset = agentOffsets.get(filePath) ?? 0;
  const fileSize = fileStat.size;

  if (fileSize <= currentOffset) return;

  const raw = await safeReadFile(filePath);
  if (!raw) return;

  const newContent = raw.slice(currentOffset);
  agentOffsets.set(filePath, fileSize);

  const lines = newContent.split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      // For session files, only process entries that belong to a team agent
      if (isSessionFile) {
        const teamName = parsed.teamName;
        const agentName = parsed.agentName;
        if (!teamName || !agentName) continue;

        // Use team agentId format: name@team
        const fullAgentId = `${agentName}@${teamName}`;

        const entry: AgentLogEntry = {
          agentId: fullAgentId,
          slug: agentName,
          sessionId: parsed.sessionId ?? '',
          type: parsed.type ?? 'assistant',
          message: {
            role: parsed.message?.role ?? '',
            content: Array.isArray(parsed.message?.content)
              ? parsed.message.content
              : typeof parsed.message?.content === 'string'
                ? [{ type: 'text' as const, text: parsed.message.content }]
                : [],
            model: parsed.message?.model,
          },
          timestamp: parsed.timestamp ?? '',
        };

        let arr = agentEntries.get(fullAgentId);
        if (!arr) {
          arr = [];
          agentEntries.set(fullAgentId, arr);
        }
        arr.push(entry);
        if (arr.length > MAX_ENTRIES_PER_AGENT) {
          arr.splice(0, arr.length - MAX_ENTRIES_PER_AGENT);
        }
        continue;
      }

      // Subagent JSONL: use agentId from the file
      const entry: AgentLogEntry = {
        agentId: parsed.agentId ?? '',
        slug: parsed.slug ?? '',
        sessionId: parsed.sessionId ?? '',
        type: parsed.type ?? 'assistant',
        message: {
          role: parsed.message?.role ?? '',
          content: Array.isArray(parsed.message?.content)
            ? parsed.message.content
            : typeof parsed.message?.content === 'string'
              ? [{ type: 'text' as const, text: parsed.message.content }]
              : [],
          model: parsed.message?.model,
        },
        timestamp: parsed.timestamp ?? '',
      };

      if (!entry.agentId) continue;

      let arr = agentEntries.get(entry.agentId);
      if (!arr) {
        arr = [];
        agentEntries.set(entry.agentId, arr);
      }
      arr.push(entry);
      if (arr.length > MAX_ENTRIES_PER_AGENT) {
        arr.splice(0, arr.length - MAX_ENTRIES_PER_AGENT);
      }
    } catch {
      // skip malformed line
    }
  }
}

// --- Snapshot assembly ---

function buildTeamOverview(teamName: string): TeamOverview {
  const config = teams.get(teamName) ?? { name: teamName, members: [] };
  const teamTasks = tasks.get(teamName) ?? [];

  const taskStats = {
    total: teamTasks.length,
    pending: teamTasks.filter(t => t.status === 'pending').length,
    inProgress: teamTasks.filter(t => t.status === 'in_progress').length,
    completed: teamTasks.filter(t => t.status === 'completed').length,
  };

  // Build agentSlugs: map agentId -> slug from agentEntries
  const agentSlugs: Record<string, string> = {};
  for (const member of config.members) {
    // Look for agent entries matching this member's agentId
    const entries = agentEntries.get(member.agentId);
    if (entries && entries.length > 0) {
      agentSlugs[member.agentId] = entries[entries.length - 1].slug;
    }
    // Also try short agentId (before @)
    const shortId = member.agentId.split('@')[0];
    if (shortId !== member.agentId) {
      const shortEntries = agentEntries.get(shortId);
      if (shortEntries && shortEntries.length > 0) {
        agentSlugs[member.agentId] = shortEntries[shortEntries.length - 1].slug;
      }
    }
  }

  // Find last activity timestamp from agent JSONL entries
  let lastActivity = '';
  for (const member of config.members) {
    const entries = agentEntries.get(member.agentId) ?? agentEntries.get(member.agentId.split('@')[0]);
    if (entries && entries.length > 0) {
      const ts = entries[entries.length - 1].timestamp;
      if (ts > lastActivity) lastActivity = ts;
    }
  }

  // Fallback: use file modification times (config + task files)
  if (!lastActivity) {
    const mtime = teamFileMtimes.get(teamName);
    if (mtime) {
      lastActivity = new Date(mtime).toISOString();
    }
  }

  return { config, tasks: teamTasks, taskStats, agentSlugs, lastActivity };
}

export function getSnapshot(): FullSnapshot {
  const teamOverviews: TeamOverview[] = [];
  const matchedAgentIds = new Set<string>();
  // Map full agentId (name@team) -> resolved entries
  const activity: Record<string, AgentLogEntry[]> = {};

  for (const teamName of teams.keys()) {
    const overview = buildTeamOverview(teamName);
    teamOverviews.push(overview);
    for (const member of overview.config.members) {
      matchedAgentIds.add(member.agentId);
      const shortId = member.agentId.split('@')[0];
      matchedAgentIds.add(shortId);

      // Resolve: try full agentId first, then short hash
      const entries = agentEntries.get(member.agentId) ?? agentEntries.get(shortId);
      if (entries && entries.length > 0) {
        activity[member.agentId] = entries;
      }
    }
  }

  // Find unmatched agents
  const unmatchedAgents: { agentId: string; slug: string; sessionId: string }[] = [];
  for (const [agentId, entries] of agentEntries) {
    if (!matchedAgentIds.has(agentId) && entries.length > 0) {
      const last = entries[entries.length - 1];
      unmatchedAgents.push({
        agentId,
        slug: last.slug,
        sessionId: last.sessionId,
      });
      activity[agentId] = entries;
    }
  }

  return { teams: teamOverviews, unmatchedAgents, agentActivity: activity };
}

// --- Query ---

export function getAgentActivity(agentId: string): AgentLogEntry[] {
  return agentEntries.get(agentId) ?? [];
}

export function getAgentSessions(agentId: string): AgentSession[] {
  const entries = agentEntries.get(agentId);
  if (!entries || entries.length === 0) return [];

  const sessionMap = new Map<string, { entries: AgentLogEntry[] }>();
  for (const entry of entries) {
    const sid = entry.sessionId || 'unknown';
    let group = sessionMap.get(sid);
    if (!group) {
      group = { entries: [] };
      sessionMap.set(sid, group);
    }
    group.entries.push(entry);
  }

  const sessions: AgentSession[] = [];
  for (const [sessionId, group] of sessionMap) {
    const first = group.entries[0];
    const last = group.entries[group.entries.length - 1];
    sessions.push({
      sessionId,
      agentId,
      slug: last.slug,
      entryCount: group.entries.length,
      firstTimestamp: first.timestamp,
      lastTimestamp: last.timestamp,
    });
  }

  // Sort by lastTimestamp descending (most recent first)
  sessions.sort((a, b) => (b.lastTimestamp > a.lastTimestamp ? 1 : -1));
  return sessions;
}

export function getSessionEntries(agentId: string, sessionId: string): AgentLogEntry[] {
  const entries = agentEntries.get(agentId);
  if (!entries) return [];
  return entries.filter(e => (e.sessionId || 'unknown') === sessionId);
}

// --- Full refresh ---

export async function refreshAll(): Promise<void> {
  await refreshTeams();
  await refreshAllTasks();
  await scanAgentJsonl();
}
