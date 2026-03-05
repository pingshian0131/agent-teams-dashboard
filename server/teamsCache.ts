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
  ProjectOverview,
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
const knownProjectDirs = new Set<string>(); // all project dir names under ~/.claude/projects/

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

  // Track all known project dirs for name resolution
  for (const d of projectDirs) {
    knownProjectDirs.add(d);
  }

  for (const projDir of projectDirs) {
    const projPath = join(PROJECTS_DIR, projDir);
    const entries = await safeReaddir(projPath);

    for (const entry of entries) {
      const entryPath = join(projPath, entry);

      // Team session JSONL: UUID.jsonl files at project root level
      if (entry.endsWith('.jsonl')) {
        await readNewEntries(entryPath, true, projDir);
        continue;
      }

      // Subagent JSONL: agent-*.jsonl under session/subagents/
      const subagentsDir = join(entryPath, 'subagents');
      const files = await safeReaddir(subagentsDir);
      for (const file of files) {
        if (!file.startsWith('agent-') || !file.endsWith('.jsonl')) continue;
        await readNewEntries(join(subagentsDir, file), false, projDir);
      }
    }
  }
}

async function readNewEntries(filePath: string, isSessionFile: boolean, projectDir?: string): Promise<void> {
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

      // For session files, only process entries that belong to a team
      if (isSessionFile) {
        const teamName = parsed.teamName;
        if (!teamName) continue;
        const agentName = parsed.agentName || 'team-lead';

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
          projectDir,
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
        projectDir,
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

/**
 * Encode a filesystem path to the Claude project dir format.
 * /Users/ping → -Users-ping
 */
function encodePathPrefix(fsPath: string): string {
  return '-' + fsPath.replace(/\//g, '-').replace(/^-/, '');
}

// The home directory prefix in encoded form, used to strip from project dir names.
// Uses HOST_HOME env var (set in Docker) or falls back to os.homedir().
const HOME_PREFIX = encodePathPrefix(process.env.HOST_HOME || homedir());

/**
 * Use the set of all known project dirs to resolve ambiguous dashes.
 * If "-Users-ping-projects" exists as a project dir, then in
 * "-Users-ping-projects-agent-teams-dashboard", the "projects" portion
 * is a directory (path separator), not part of a directory name.
 *
 * Returns the last path segment (the actual project directory name).
 */
function resolveProjectName(projectDir: string, allProjectDirs: Set<string>): string {
  if (projectDir === HOME_PREFIX) return '~';

  const prefixWithDash = HOME_PREFIX + '-';
  if (!projectDir.startsWith(prefixWithDash)) return projectDir;

  const remainder = projectDir.slice(prefixWithDash.length);

  // Try to find the longest known parent directory prefix.
  // A known dir is a valid parent only if:
  // 1. It's a strict prefix of projectDir (not equal to it)
  // 2. No OTHER known dir starts with it + the next dash-segment
  //    (which would mean the continuation is part of the dir name, not a child)
  let bestSplit = 0;
  const parts = remainder.split('-');
  let accumulated = HOME_PREFIX;
  for (let i = 0; i < parts.length - 1; i++) {
    accumulated += '-' + parts[i];
    if (!allProjectDirs.has(accumulated) || accumulated === projectDir) continue;

    // Check: is there another known dir that starts with accumulated + '-' + nextPart?
    // If so, accumulated might not be a true parent — the next segment could be part
    // of a longer directory name at the same level.
    const nextAccumulated = accumulated + '-' + parts[i + 1];
    // When nextAccumulated === projectDir, accumulated could be a real parent
    // (e.g. panamera-python3 → worktree3) or a false parent (e.g. erp-shipment → 2).
    // Heuristic: accumulated is a real parent if other known dirs also have it as prefix.
    if (nextAccumulated === projectDir) {
      const accPrefix = accumulated + '-';
      const hasOtherChildren = Array.from(allProjectDirs).some(
        d => d !== projectDir && d.startsWith(accPrefix)
      );
      if (hasOtherChildren) {
        bestSplit = i + 1;
      }
      continue;
    }

    const isFalseParent = allProjectDirs.has(nextAccumulated) &&
      projectDir.startsWith(nextAccumulated);
    if (!isFalseParent) {
      bestSplit = i + 1;
    }
  }

  if (bestSplit > 0) {
    return parts.slice(bestSplit).join('-');
  }
  return remainder;
}

function buildProjectOverviews(): ProjectOverview[] {
  // Group all agent entries by projectDir
  const projectMap = new Map<string, Map<string, { slug: string; entries: AgentLogEntry[] }>>();

  for (const [agentId, entries] of agentEntries) {
    for (const entry of entries) {
      if (!entry.projectDir) continue;
      let agentMap = projectMap.get(entry.projectDir);
      if (!agentMap) {
        agentMap = new Map();
        projectMap.set(entry.projectDir, agentMap);
      }
      let agentData = agentMap.get(agentId);
      if (!agentData) {
        agentData = { slug: entry.slug, entries: [] };
        agentMap.set(agentId, agentData);
      }
      agentData.entries.push(entry);
      if (entry.slug) agentData.slug = entry.slug;
    }
  }

  const projects: ProjectOverview[] = [];
  for (const [projectDir, agentMap] of projectMap) {
    let lastActivity = '';
    const agents: ProjectOverview['agents'] = [];

    for (const [agentId, data] of agentMap) {
      const lastTs = data.entries.length > 0
        ? data.entries[data.entries.length - 1].timestamp
        : '';
      agents.push({
        agentId,
        slug: data.slug || agentId,
        entryCount: data.entries.length,
        lastTimestamp: lastTs,
      });
      if (lastTs > lastActivity) lastActivity = lastTs;
    }

    agents.sort((a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp));

    projects.push({
      projectDir,
      projectName: resolveProjectName(projectDir, knownProjectDirs),
      agents,
      lastActivity,
    });
  }

  projects.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  return projects;
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

  return { teams: teamOverviews, unmatchedAgents, agentActivity: activity, projects: buildProjectOverviews() };
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
