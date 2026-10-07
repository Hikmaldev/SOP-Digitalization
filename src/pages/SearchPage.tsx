import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { searchSops } from '../api/endpoints';
import { useApi, useDebouncedValue } from '../api/hooks';
import { StatusBadge } from '../components/Badge';
import { ButtonLink } from '../components/Button';
import { Icon } from '../components/Icon';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import { useAuth } from '../context/auth-context';
import { useWorkspace } from '../context/workspace-context';
import { formatRelativeTime, TONE_GLYPH, toneFor, versionLabel } from '../lib/display';

/** Highlights the first case-insensitive match of `query` inside `text`. */
function highlight(text: string, query: string): ReactNode {
  const needle = query.trim().toLowerCase();
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const departmentId = searchParams.get('dept') ?? '';
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const { user } = useAuth();
  const { departments } = useWorkspace();

  const canIncludeDrafts = user?.role !== 'viewer';
  const debouncedQuery = useDebouncedValue(query, 250);

  const state = useApi(
    () =>
      searchSops({
        q: debouncedQuery || undefined,
        departmentId: departmentId || undefined,
        includeDrafts: canIncludeDrafts && includeDrafts,
      }),
    [debouncedQuery, departmentId, includeDrafts, canIncludeDrafts],
  );

  const results = state.data ?? [];
  const visibleQuery = query.trim();

  function updateParam(key: string, value: string) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  return (
    <div className="page-wrap">
      <div className="screen-title">
        <div>
          <p className="eyebrow">SOP LIBRARY</p>
          <h1>Find the right way to work</h1>
          <p>Search published procedures across every department.</p>
        </div>
        <ButtonLink to="/sops/new">
          <span className="plus">+</span> Create new SOP
        </ButtonLink>
      </div>

      <div className="filter-row">
        <div className="search-field">
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => updateParam('q', event.target.value)}
            placeholder="Search across titles, body text, and diagram annotations"
            aria-label="Search keyword"
          />
        </div>
        <select
          className="filter-button"
          value={departmentId}
          onChange={(event) => updateParam('dept', event.target.value)}
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
        <button className="search-button" type="button" onClick={state.reload}>
          Search
        </button>
        {canIncludeDrafts && (
          <button
            type="button"
            className={`mini-button ${includeDrafts ? 'primary' : ''}`}
            onClick={() => setIncludeDrafts((value) => !value)}
          >
            Include my drafts
          </button>
        )}
      </div>

      <div className="results-meta">
        <span>
          <strong>{results.length}</strong> result{results.length === 1 ? '' : 's'}
          {visibleQuery ? <> for “{visibleQuery}”</> : ' in the published library'}
        </span>
        <span className="sort-button">Relevance ▾</span>
      </div>

      {state.status === 'error' ? (
        <ErrorPanel message={state.error ?? 'Search failed'} onRetry={state.reload} />
      ) : state.status === 'loading' && results.length === 0 ? (
        <LoadingPanel label="Searching the library…" />
      ) : results.length === 0 ? (
        <div className="detail-card state-panel">
          No published SOPs match your search. Try a different keyword or check the department filter.
        </div>
      ) : (
        results.map((result) => {
          const tone = toneFor(result.departmentId);
          return (
            <Link key={result.versionId} className="library-result" to={`/sops/${result.sopId}`}>
              <div className={`result-icon ${tone}`} aria-hidden="true">
                {TONE_GLYPH[tone]}
              </div>
              <div className="result-copy">
                <h3>{highlight(result.title, visibleQuery)}</h3>
                {result.bodyExcerpt && <p>{highlight(result.bodyExcerpt, visibleQuery)}…</p>}
                <div className="result-details">
                  <span>{result.departmentName}</span>
                  <b>·</b>
                  <span>Updated {formatRelativeTime(result.updatedAt)}</span>
                  <b>·</b>
                  <span>{versionLabel(result.versionNumber)}</span>
                </div>
              </div>
              <StatusBadge status={result.status} />
              <span className="result-chevron">›</span>
            </Link>
          );
        })
      )}
    </div>
  );
}
