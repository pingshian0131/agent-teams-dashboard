import { useState, useRef, useEffect, useCallback } from 'react';
import type { ProjectOverview, ViewSelection } from '../types';

interface SearchBarProps {
  projects: ProjectOverview[];
  selectedProject?: string;
  onSearch: (sel: ViewSelection) => void;
}

export default function SearchBar({ projects, selectedProject, onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState(selectedProject ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external project selection
  useEffect(() => {
    setProjectFilter(selectedProject ?? '');
  }, [selectedProject]);

  // Cmd+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    onSearch({ view: 'search', query: q, projectDir: projectFilter || undefined });
  }, [query, projectFilter, onSearch]);

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <select
        className="search-bar__project"
        value={projectFilter}
        onChange={(e) => setProjectFilter(e.target.value)}
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.projectDir} value={p.projectDir}>
            {p.projectName}
          </option>
        ))}
      </select>
      <div className="search-bar__input-wrap">
        <input
          ref={inputRef}
          className="search-bar__input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations... (Cmd+K)"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className="search-bar__clear"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
          >
            x
          </button>
        )}
      </div>
      <button className="search-bar__btn" type="submit" disabled={query.trim().length < 2}>
        Search
      </button>
    </form>
  );
}
