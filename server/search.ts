import { readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const DEFAULT_MAX_RESULTS = 50;
const SNIPPET_CONTEXT = 100; // chars before/after match
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

interface SearchOptions {
  query: string;
  projectDir?: string; // filter to specific project
  limit?: number;
  maxAgeDays?: number;
}

/** Extract all searchable text from a JSONL entry's message content blocks. */
function extractSearchableText(content: unknown[]): { field: 'text' | 'tool_use' | 'tool_result'; text: string }[] {
  const segments: { field: 'text' | 'tool_use' | 'tool_result'; text: string }[] = [];
  if (!Array.isArray(content)) return segments;

  for (const c of content) {
    if (!c || typeof c !== 'object') continue;
    const block = c as Record<string, unknown>;

    if (block.type === 'text' && typeof block.text === 'string') {
      segments.push({ field: 'text', text: block.text });
    } else if (block.type === 'tool_use') {
      const name = typeof block.name === 'string' ? block.name : '';
      const inputStr = block.input ? JSON.stringify(block.input) : '';
      segments.push({ field: 'tool_use', text: `${name} ${inputStr}` });
    } else if (block.type === 'tool_result') {
      const raw = block.content;
      let text: string;
      if (typeof raw === 'string') text = raw;
      else if (Array.isArray(raw)) text = raw.map((item: any) => item?.text ?? '').join(' ');
      else if (raw != null) try { text = JSON.stringify(raw); } catch { text = String(raw); }
      else text = '';
      segments.push({ field: 'tool_result', text });
    }
  }
  return segments;
}

/** Build a snippet around the match position. */
function buildSnippet(text: string, matchIndex: number, queryLen: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT);
  const end = Math.min(text.length, matchIndex + queryLen + SNIPPET_CONTEXT);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  // Collapse whitespace for readability
  return snippet.replace(/\n/g, ' ').replace(/\s+/g, ' ');
}

/** Resolve agentId and slug from a parsed JSONL line. */
function resolveAgent(parsed: Record<string, unknown>): { agentId: string; slug: string } | null {
  const type = parsed.type;
  if (type !== 'user' && type !== 'assistant') return null;

  const teamName = parsed.teamName as string | undefined;
  const sessionId = parsed.sessionId as string | undefined;

  if (teamName) {
    const agentName = (parsed.agentName as string) || 'team-lead';
    return { agentId: `${agentName}@${teamName}`, slug: agentName };
  }
  if (sessionId) {
    const slug = (parsed.slug as string) || sessionId.slice(0, 8);
    return { agentId: `session:${sessionId}`, slug };
  }
  return null;
}

async function collectJsonlFiles(projectPath: string, maxAgeMs: number): Promise<string[]> {
  const files: string[] = [];
  const now = Date.now();

  async function walk(dir: string) {
    let entries: string[];
    try { entries = await readdir(dir); } catch { return; }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let st;
      try { st = await stat(fullPath); } catch { continue; }

      if (st.isDirectory()) {
        await walk(fullPath);
      } else if (entry.endsWith('.jsonl') && now - st.mtimeMs < maxAgeMs) {
        files.push(fullPath);
      }
    }
  }

  await walk(projectPath);
  return files;
}

export async function searchConversations(options: SearchOptions): Promise<SearchResult[]> {
  const { query, projectDir, limit = DEFAULT_MAX_RESULTS, maxAgeDays = 30 } = options;
  if (!query || query.length < 2) return [];

  const queryLower = query.toLowerCase();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const results: SearchResult[] = [];

  // Determine which project dirs to scan
  let projectDirs: string[];
  if (projectDir) {
    projectDirs = [projectDir];
  } else {
    try {
      projectDirs = await readdir(PROJECTS_DIR);
    } catch {
      return [];
    }
  }

  for (const pDir of projectDirs) {
    if (results.length >= limit) break;

    const projectPath = join(PROJECTS_DIR, pDir);
    const jsonlFiles = await collectJsonlFiles(projectPath, maxAgeMs);

    for (const filePath of jsonlFiles) {
      if (results.length >= limit) break;

      await searchFile(filePath, pDir, queryLower, query.length, limit - results.length, results);
    }
  }

  // Sort by timestamp descending (most recent first)
  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return results;
}

async function searchFile(
  filePath: string,
  projectDir: string,
  queryLower: string,
  queryLen: number,
  remaining: number,
  results: SearchResult[],
): Promise<void> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let found = 0;

  for await (const line of rl) {
    if (found >= remaining) { rl.close(); break; }
    if (!line) continue;

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(line); } catch { continue; }

    const agent = resolveAgent(parsed);
    if (!agent) continue;

    const msg = parsed.message as Record<string, unknown> | undefined;
    if (!msg) continue;

    const content = msg.content;
    const contentArr = Array.isArray(content)
      ? content
      : typeof content === 'string'
        ? [{ type: 'text', text: content }]
        : [];

    const segments = extractSearchableText(contentArr);

    for (const seg of segments) {
      const idx = seg.text.toLowerCase().indexOf(queryLower);
      if (idx === -1) continue;

      results.push({
        agentId: agent.agentId,
        slug: agent.slug,
        sessionId: (parsed.sessionId as string) ?? '',
        projectDir,
        timestamp: (parsed.timestamp as string) ?? '',
        type: (parsed.type as 'user' | 'assistant') ?? 'assistant',
        snippet: buildSnippet(seg.text, idx, queryLen),
        matchField: seg.field,
      });
      found++;
      break; // one match per entry is enough
    }
  }
}
