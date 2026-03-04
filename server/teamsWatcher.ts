import { watch, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import * as cache from './teamsCache.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const TEAMS_DIR = join(CLAUDE_DIR, 'teams');
const TASKS_DIR = join(CLAUDE_DIR, 'tasks');

const DEBOUNCE_MS = 200;
const JSONL_POLL_MS = 2000;
const DIR_CHECK_MS = 5000;
const FULL_REFRESH_MS = 5000; // Fallback polling for environments where fs.watch doesn't work (e.g. Docker bind mounts)

let tasksWatcher: ReturnType<typeof watch> | null = null;
let teamsWatcher: ReturnType<typeof watch> | null = null;
let jsonlTimer: ReturnType<typeof setInterval> | null = null;
let dirCheckTimer: ReturnType<typeof setInterval> | null = null;
let fullRefreshTimer: ReturnType<typeof setInterval> | null = null;

// --- Debounce helper ---

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as unknown as T;
}

// --- Tasks watcher ---

function startTasksWatcher(): void {
  if (tasksWatcher) return;
  if (!existsSync(TASKS_DIR)) return;

  const onTaskChange = debounce(async (_event: string, filename: string | null) => {
    if (!filename) {
      // Full refresh if no filename
      for (const team of (await import('./teamsCache.js')).getSnapshot().teams) {
        await cache.refreshTasks(team.config.name);
      }
    } else {
      // filename could be "teamName/1.json" or just "teamName"
      const teamId = filename.split('/')[0];
      if (teamId) {
        await cache.refreshTasks(teamId);
      }
    }
    cache.onChange.emit('change');
  }, DEBOUNCE_MS);

  try {
    tasksWatcher = watch(TASKS_DIR, { recursive: true }, onTaskChange);
    tasksWatcher.on('error', () => {
      tasksWatcher?.close();
      tasksWatcher = null;
    });
  } catch {
    // watch not supported or dir not accessible
  }
}

// --- Teams watcher ---

function startTeamsWatcher(): void {
  if (teamsWatcher) return;
  if (!existsSync(TEAMS_DIR)) return;

  const onTeamChange = debounce(async () => {
    await cache.refreshTeams();
    // Also refresh tasks in case new team appeared
    for (const team of cache.getSnapshot().teams) {
      await cache.refreshTasks(team.config.name);
    }
    cache.onChange.emit('change');
  }, DEBOUNCE_MS);

  try {
    teamsWatcher = watch(TEAMS_DIR, { recursive: true }, onTeamChange);
    teamsWatcher.on('error', () => {
      teamsWatcher?.close();
      teamsWatcher = null;
    });
  } catch {
    // watch not supported
  }
}

// --- Directory existence poller (for dirs that may not yet exist) ---

function startDirCheckPoller(): void {
  dirCheckTimer = setInterval(() => {
    if (!tasksWatcher && existsSync(TASKS_DIR)) {
      startTasksWatcher();
    }
    if (!teamsWatcher && existsSync(TEAMS_DIR)) {
      startTeamsWatcher();
    }
    // Stop polling once both watchers are up
    if (tasksWatcher && teamsWatcher && dirCheckTimer) {
      clearInterval(dirCheckTimer);
      dirCheckTimer = null;
    }
  }, DIR_CHECK_MS);
}

// --- Full refresh poller (fallback for Docker / environments without fs.watch) ---

function startFullRefreshPoller(): void {
  let lastSnapshot = '';
  fullRefreshTimer = setInterval(async () => {
    await cache.refreshTeams();
    for (const team of cache.getSnapshot().teams) {
      await cache.refreshTasks(team.config.name);
    }
    const snapshot = JSON.stringify(cache.getSnapshot());
    if (snapshot !== lastSnapshot) {
      lastSnapshot = snapshot;
      cache.onChange.emit('change');
    }
  }, FULL_REFRESH_MS);
}

// --- Agent JSONL poller ---

function startJsonlPoller(): void {
  let lastSnapshot = '';
  jsonlTimer = setInterval(async () => {
    await cache.scanAgentJsonl();
    const snapshot = JSON.stringify(cache.getSnapshot());
    if (snapshot !== lastSnapshot) {
      lastSnapshot = snapshot;
      cache.onChange.emit('change');
    }
  }, JSONL_POLL_MS);
}

// --- Public API ---

export function startWatching(): void {
  startTasksWatcher();
  startTeamsWatcher();
  startJsonlPoller();
  startFullRefreshPoller();

  // If either dir doesn't exist yet, poll for them
  if (!tasksWatcher || !teamsWatcher) {
    startDirCheckPoller();
  }
}

export function stopWatching(): void {
  tasksWatcher?.close();
  tasksWatcher = null;
  teamsWatcher?.close();
  teamsWatcher = null;
  if (jsonlTimer) {
    clearInterval(jsonlTimer);
    jsonlTimer = null;
  }
  if (dirCheckTimer) {
    clearInterval(dirCheckTimer);
    dirCheckTimer = null;
  }
  if (fullRefreshTimer) {
    clearInterval(fullRefreshTimer);
    fullRefreshTimer = null;
  }
}
