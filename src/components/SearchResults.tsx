import { useState, useEffect } from 'react';
import type { SearchResult, ViewSelection, ProjectOverview } from '../types';
import { fetchSearch } from '../api';

interface SearchResultsProps {
  query: string;
  projectDir?: string;
  projects: ProjectOverview[];
  onSelect: (sel: ViewSelection) => void;
}

function formatTime(ts: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-GB', { month: '2-digit', day: '2-digit' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function resolveProjectName(projectDir: string, projects: ProjectOverview[]): string {
  const p = projects.find((pr) => pr.projectDir === projectDir);
  return p?.projectName ?? projectDir;
}

function HighlightSnippet({ snippet, query }: { snippet: string; query: string }) {
  const lower = snippet.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return <span>{snippet}</span>;

  return (
    <span>
      {snippet.slice(0, idx)}
      <mark className="search-highlight">{snippet.slice(idx, idx + query.length)}</mark>
      {snippet.slice(idx + query.length)}
    </span>
  );
}

const FIELD_LABELS: Record<string, string> = {
  text: 'text',
  tool_use: 'tool',
  tool_result: 'result',
};

export default function SearchResults({ query, projectDir, projects, onSelect }: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSearch(query, projectDir)
      .then((data) => {
        if (!cancelled) {
          setResults(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [query, projectDir]);

  const handleClick = (r: SearchResult) => {
    onSelect({
      view: 'agent',
      agentId: r.agentId,
      agentSlug: r.slug,
      sessionId: r.sessionId || undefined,
    });
  };

  return (
    <div className="search-results">
      <div className="search-results__header">
        <span className="search-results__title">
          Search: "<span className="text-cyan">{query}</span>"
          {projectDir && (
            <span className="text-muted"> in {resolveProjectName(projectDir, projects)}</span>
          )}
        </span>
        {!loading && (
          <span className="text-muted text-xs">{results.length} results</span>
        )}
      </div>

      <div className="search-results__list">
        {loading && (
          <div className="search-results__loading">
            <span className="text-muted">Searching...</span>
          </div>
        )}

        {error && (
          <div className="search-results__error">
            <span className="text-red">Error: {error}</span>
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="search-results__empty">
            <span className="text-muted">No matches found</span>
          </div>
        )}

        {results.map((r, i) => (
          <button
            key={`${r.sessionId}-${r.timestamp}-${i}`}
            className="search-results__item"
            onClick={() => handleClick(r)}
          >
            <div className="search-results__item-header">
              <span className="search-results__item-slug">{r.slug}</span>
              <span className={`search-results__item-field search-results__item-field--${r.matchField}`}>
                {FIELD_LABELS[r.matchField] ?? r.matchField}
              </span>
              <span className="search-results__item-type" data-type={r.type}>
                {r.type}
              </span>
              <span className="search-results__item-project text-muted">
                {resolveProjectName(r.projectDir, projects)}
              </span>
              <span className="search-results__item-time text-muted">{formatTime(r.timestamp)}</span>
            </div>
            <div className="search-results__item-snippet">
              <HighlightSnippet snippet={r.snippet} query={query} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
