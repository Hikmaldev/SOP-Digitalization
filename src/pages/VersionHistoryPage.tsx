import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { listHistory } from '../api/endpoints';
import { useApi, useDebouncedValue } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/Badge';
import { Icon } from '../components/Icon';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import { colorForUser, formatDate, initialsOf, versionLabel } from '../lib/display';
import type { VersionStatus } from '../types';

const FILTERS: Array<{ value: '' | VersionStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'draft', label: 'Draft' },
  { value: 'rejected', label: 'Rejected' },
];

export function VersionHistoryPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'' | VersionStatus>('');
  const debouncedQuery = useDebouncedValue(query, 250);

  const state = useApi(
    () =>
      listHistory({
        q: debouncedQuery || undefined,
        status: status || undefined,
        limit: 50,
      }),
    [debouncedQuery, status],
  );

  const rows = state.data ?? [];
  const totals = useMemo(() => {
    const list = state.data ?? [];
    return {
      total: list.length,
      published: list.filter((row) => row.status === 'published').length,
      rejected: list.filter((row) => row.status === 'rejected').length,
    };
  }, [state.data]);

  return (
    <div className="page-wrap">
      <div className="screen-title">
        <div>
          <p className="eyebrow">AUDIT TRAIL</p>
          <h1>Version history</h1>
          <p>Every change is recorded. No published version is overwritten.</p>
        </div>
        <Link className="button button-secondary" to="/search">
          <Icon name="search" size={15} /> Search SOP library
        </Link>
      </div>

      <div className="filter-row">
        <div className="search-field">
          <Icon name="search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by SOP title or change summary"
            aria-label="Search history"
          />
        </div>
        <select
          className="filter-button"
          value={status}
          onChange={(event) => setStatus(event.target.value as '' | VersionStatus)}
          aria-label="Filter by status"
        >
          {FILTERS.map((filter) => (
            <option key={filter.label} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {state.status === 'error' ? (
        <ErrorPanel message={state.error ?? 'Failed to load history'} onRetry={state.reload} />
      ) : state.status === 'loading' && rows.length === 0 ? (
        <LoadingPanel label="Loading history…" />
      ) : (
        <div className="history-card">
          <div className="results-meta" style={{ marginTop: 0 }}>
            <span>
              <strong>{rows.length}</strong> version{rows.length === 1 ? '' : 's'} in the latest records
            </span>
            <span className="sort-button">Most recently changed ▾</span>
          </div>
          <table className="history-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>SOP</th>
                <th>Change summary</th>
                <th>Changed by</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.versionId}>
                  <td className="version-number">{versionLabel(row.versionNumber)}</td>
                  <td>
                    <Link to={`/sops/${row.sopId}`} style={{ color: 'inherit' }}>
                      <strong>{row.sopTitle}</strong>
                    </Link>
                    <br />
                    <span style={{ color: '#a5b0bd', fontSize: 10 }}>{row.departmentName}</span>
                  </td>
                  <td className="change-summary">{row.changeSummary ?? '—'}</td>
                  <td>
                    <div className="person">
                      <Avatar initials={initialsOf(row.createdByName)} color={colorForUser(row.createdBy)} />
                      {row.createdByName}
                    </div>
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 12px' }}>
                    No versions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="history-side" style={{ marginTop: 15, gridTemplateColumns: '1fr 1fr' }}>
        <section className="detail-card">
          <h3>Versioning principle</h3>
          <p className="detail-card-p">
            Published SOPs never change in place. Every edit creates a new version, and the previous
            version stays readable as superseded.
          </p>
        </section>
        <section className="detail-card">
          <h3>Audit summary</h3>
          <div className="audit-stat">
            <span>Versions shown</span>
            <strong>{totals.total}</strong>
          </div>
          <div className="audit-stat">
            <span>Published versions</span>
            <strong>{totals.published}</strong>
          </div>
          <div className="audit-stat">
            <span>Rejected drafts</span>
            <strong>{totals.rejected}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}
