import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { listSops } from '../api/endpoints';
import { useApi } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/Badge';
import { ButtonLink } from '../components/Button';
import { Icon } from '../components/Icon';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import { useAuth } from '../context/auth-context';
import { useWorkspace } from '../context/workspace-context';
import {
  colorForUser,
  formatRelativeTime,
  initialsOf,
  TONE_GLYPH,
  toneFor,
  versionLabel,
} from '../lib/display';
import type { SopListItem } from '../types';

interface MetricProps {
  label: string;
  icon: string;
  iconClass: string;
  value: string;
  denom?: string;
  unit?: string;
  footnote: Array<{ text: string; tone?: 'positive' | 'attention' }>;
}

function MetricCard({ label, icon, iconClass, value, denom, unit, footnote }: MetricProps) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon ${iconClass}`}>{icon}</span>
      </div>
      <strong className="metric-number">
        {value}
        {denom != null && <span className="metric-denom">{denom}</span>}
        {unit != null && <span className="metric-unit">{unit}</span>}
      </strong>
      <div className="metric-foot">
        {footnote.map((entry) =>
          entry.tone ? (
            <span key={entry.text} className={entry.tone}>
              {entry.text}
            </span>
          ) : (
            <span key={entry.text}>{entry.text}</span>
          ),
        )}
      </div>
    </article>
  );
}

export function OverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { departments, approvals } = useWorkspace();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [today] = useState(() =>
    new Date()
      .toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase(),
  );

  const canReview = user?.role === 'approver' || user?.role === 'admin';
  const sopsState = useApi(() => listSops({ includeDrafts: true, limit: 100 }), []);
  const items: SopListItem[] = sopsState.data ?? [];

  const publishedCount = items.filter((item) => item.publishedVersion).length;
  const ownPending = items.filter((item) => item.latestVersion?.status === 'pending_approval');
  const awaitingCount = canReview ? approvals.length : ownPending.length;

  const coveredIds = new Set(items.filter((item) => item.publishedVersion).map((item) => item.departmentId));
  const totalDepartments = departments.length || 1;
  const coveragePct = Math.round((coveredIds.size / totalDepartments) * 100);

  const coverageRows = useMemo(() => {
    const list = sopsState.data ?? [];
    return departments
      .map((dept) => ({
        departmentId: dept.id,
        name: dept.name,
        count: list.filter((item) => item.departmentId === dept.id && item.publishedVersion).length,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [departments, sopsState.data]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (department) params.set('dept', department);
    navigate(`/search?${params.toString()}`);
  }

  const recent = items.slice(0, 5);
  const reviews = canReview ? approvals.slice(0, 3) : [];
  const ownReviews = canReview ? [] : ownPending.slice(0, 3);
  const maxCoverage = coverageRows[0]?.count ?? 1;

  return (
    <div className="page-content">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>
            Good to see you, {user?.fullName.split(' ')[0] ?? 'there'} <span className="wave">✦</span>
          </h1>
          <p className="subheading">Keep your team's way of working clear, current, and easy to find.</p>
        </div>
        <ButtonLink to="/sops/new">
          <span className="plus">+</span> Create new SOP
        </ButtonLink>
      </section>

      <section className="search-panel" aria-label="Search SOPs">
        <div className="search-heading">
          <div>
            <h2>What do you need to do?</h2>
            <p>Search across published SOPs, steps, and process annotations.</p>
          </div>
          <span className="shortcut">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
          </span>
        </div>
        <form className="search-controls" onSubmit={handleSearch}>
          <div className="search-field">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Try "invoice approval" or "new hire"'
              aria-label="Search keyword"
            />
          </div>
          <select
            className="filter-button"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            aria-label="Filter by department"
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <button className="search-button" type="submit">
            Search
          </button>
        </form>
        <div className="search-hints">
          <span>Popular searches</span>
          <Link to="/search?q=Leave request">Leave request</Link>
          <Link to="/search?q=Vendor">Vendor</Link>
          <Link to="/search?q=Onboarding">Onboarding</Link>
        </div>
      </section>

      {sopsState.status === 'error' ? (
        <ErrorPanel message={sopsState.error ?? 'Failed to load the workspace'} onRetry={sopsState.reload} />
      ) : sopsState.status === 'loading' && items.length === 0 ? (
        <LoadingPanel label="Loading your workspace…" />
      ) : (
        <>
          <section className="metrics-grid" aria-label="SOP metrics">
            <MetricCard
              label="Published SOPs"
              icon="✓"
              iconClass="green-icon"
              value={String(publishedCount)}
              footnote={[{ text: '✓ current', tone: 'positive' }, { text: 'approved versions only' }]}
            />
            <MetricCard
              label={canReview ? 'Awaiting review' : 'Awaiting approval'}
              icon="◷"
              iconClass="orange-icon"
              value={String(awaitingCount).padStart(2, '0')}
              footnote={[
                { text: awaitingCount > 0 ? 'Needs attention' : 'All clear', tone: awaitingCount > 0 ? 'attention' : 'positive' },
                { text: canReview ? 'in approval queue' : 'your submissions' },
              ]}
            />
            <MetricCard
              label="Departments covered"
              icon="▦"
              iconClass="blue-icon"
              value={String(coveredIds.size)}
              denom={`/ ${departments.length}`}
              footnote={[{ text: `${coveragePct}%`, tone: 'positive' }, { text: 'company coverage' }]}
            />
            <MetricCard
              label="Avg. time to find"
              icon="⌁"
              iconClass="purple-icon"
              value="18"
              unit="sec"
              footnote={[{ text: '↓ 6 sec', tone: 'positive' }, { text: 'under 30 sec goal' }]}
            />
          </section>

          <div className="content-grid">
            <section className="panel recent-panel" id="library">
              <div className="panel-heading">
                <div>
                  <h2>Recently updated</h2>
                  <p>Latest changes across your SOP library.</p>
                </div>
                <Link className="text-link" to="/search">
                  View all <span>→</span>
                </Link>
              </div>
              <div className="sop-list">
                {recent.map((item) => {
                  const tone = toneFor(item.departmentId);
                  return (
                    <Link key={item.id} className="sop-row" to={`/sops/${item.id}`}>
                      <div className={`doc-icon doc-${tone}`} aria-hidden="true">
                        <span>{TONE_GLYPH[tone]}</span>
                      </div>
                      <div className="sop-info">
                        <h3>{item.title}</h3>
                        <div>
                          <span>{item.departmentName}</span>
                          <b>·</b>
                          <span>
                            Updated {item.latestVersion ? formatRelativeTime(item.latestVersion.updatedAt) : '—'}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={item.latestVersion?.status ?? 'draft'} />
                      <span className="version">
                        {item.latestVersion ? versionLabel(item.latestVersion.versionNumber) : '—'}
                      </span>
                      <span className="row-arrow">›</span>
                    </Link>
                  );
                })}
                {recent.length === 0 && (
                  <p className="state-panel" style={{ padding: '24px 0' }}>
                    No SOPs yet. Create the first one.
                  </p>
                )}
              </div>
            </section>

            <aside className="panel review-panel" id="approvals">
              <div className="panel-heading">
                <div>
                  <h2>
                    {canReview ? 'Needs your review' : 'Department drafts in review'}{' '}
                    <span className="small-badge">{awaitingCount}</span>
                  </h2>
                  <p>{canReview ? 'Drafts waiting for your decision.' : 'Drafts waiting for an approver.'}</p>
                </div>
                <span className="more-button" aria-hidden="true">
                  •••
                </span>
              </div>
              <div className="review-list">
                {reviews.map((item) => (
                  <Link key={item.versionId} className="review-item" to="/approvals" style={{ textDecoration: 'none' }}>
                    <Avatar
                      initials={initialsOf(item.submittedByName)}
                      color={colorForUser(item.submittedById)}
                    />
                    <div className="review-copy">
                      <h3>{item.title}</h3>
                      <p>
                        {item.submittedByName} · {item.departmentName}
                      </p>
                      <div className="review-meta">
                        <StatusBadge status="pending_approval" />
                        <span>{formatRelativeTime(item.submittedAt)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
                {ownReviews.map((item) => {
                  const tone = toneFor(item.departmentId);
                  return (
                    <Link key={item.id} className="review-item" to={`/sops/${item.id}`} style={{ textDecoration: 'none' }}>
                      <div className={`doc-icon doc-${tone}`} aria-hidden="true">
                        <span>{TONE_GLYPH[tone]}</span>
                      </div>
                      <div className="review-copy">
                        <h3>{item.title}</h3>
                        <p>{item.departmentName}</p>
                        <div className="review-meta">
                          <StatusBadge status="pending_approval" />
                          <span>
                            {item.latestVersion ? formatRelativeTime(item.latestVersion.updatedAt) : '—'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {reviews.length === 0 && ownReviews.length === 0 && (
                  <p className="state-panel" style={{ padding: '21px 0' }}>
                    Nothing waiting. Nice work.
                  </p>
                )}
              </div>
              {canReview && (
                <Link className="queue-link" to="/approvals">
                  Open approval queue <span>→</span>
                </Link>
              )}
            </aside>
          </div>

          <div className="bottom-grid">
            <section className="panel coverage-panel" id="departments">
              <div className="panel-heading">
                <div>
                  <h2>Department coverage</h2>
                  <p>Published SOPs by team.</p>
                </div>
                <Link className="text-link" to="/search">
                  Browse <span>→</span>
                </Link>
              </div>
              <div className="coverage-content">
                <div className="coverage-chart">
                  <div
                    className="chart-ring"
                    style={{
                      background: `conic-gradient(#4d9c8c 0 ${coveragePct}%, #edf0f4 ${coveragePct}% 100%)`,
                    }}
                  >
                    <div>
                      <strong>
                        {coveragePct}
                        <span>%</span>
                      </strong>
                      <small>covered</small>
                    </div>
                  </div>
                </div>
                <div className="department-bars">
                  {coverageRows.slice(0, 4).map((row) => (
                    <div key={row.departmentId} className="bar-row">
                      <div>
                        <span>{row.name}</span>
                        <b>{row.count}</b>
                      </div>
                      <i aria-hidden="true">
                        <em style={{ width: `${Math.max(8, Math.round((row.count / maxCoverage) * 100))}%` }} />
                      </i>
                    </div>
                  ))}
                  {coverageRows.length === 0 && (
                    <p style={{ margin: 0, color: '#9ca8b8', fontSize: 11 }}>
                      No published SOPs yet — coverage will appear here.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <article className="panel principle-panel">
              <div className="principle-art" aria-hidden="true">
                <span className="art-line line-one" />
                <span className="art-line line-two" />
                <span className="art-node node-one">✓</span>
                <span className="art-node node-two">↗</span>
                <span className="art-node node-three">✓</span>
              </div>
              <div className="principle-copy">
                <span className="eyebrow">THE SOPLY PRINCIPLE</span>
                <h2>
                  One process.
                  <br />
                  <em>One current version.</em>
                </h2>
                <p>Every change is recorded, reviewed, and approved before it becomes the source of truth.</p>
                <Link className="text-link" to="/history">
                  How versioning works <span>→</span>
                </Link>
              </div>
            </article>
          </div>

          <footer className="footer">
            <span>SOPly workspace · Internal use only</span>
            <span>
              All systems operational <i className="online-dot" />
            </span>
          </footer>
        </>
      )}
    </div>
  );
}
