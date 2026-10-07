import { useState } from 'react';
import { Link } from 'react-router';
import { decideOnVersion, decidedApprovals, sopDetail } from '../api/endpoints';
import { useApi } from '../api/hooks';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/Badge';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import { useWorkspace } from '../context/workspace-context';
import {
  colorForUser,
  formatRelativeTime,
  initialsOf,
  splitLines,
  TONE_GLYPH,
  toneFor,
  versionLabel,
} from '../lib/display';
import type { ApprovalDecision, PendingApprovalItem, SopDetailResponse, SopVersion } from '../types';

type DiffKind = 'same' | 'add' | 'remove';

interface DiffRow {
  text: string;
  kind: DiffKind;
}

/** Simple line diff between the published version and the new draft. */
function diff(oldLines: string[], newLines: string[]): DiffRow[] {
  const rows: DiffRow[] = [];
  const length = Math.max(oldLines.length, newLines.length);
  for (let index = 0; index < length; index += 1) {
    const oldLine = oldLines[index];
    const newLine = newLines[index];
    if (oldLine === undefined && newLine !== undefined) {
      rows.push({ text: newLine, kind: 'add' });
    } else if (newLine === undefined && oldLine !== undefined) {
      rows.push({ text: oldLine, kind: 'remove' });
    } else if (oldLine === newLine) {
      rows.push({ text: oldLine ?? '', kind: 'same' });
    } else {
      rows.push({ text: oldLine ?? '', kind: 'remove' });
      rows.push({ text: newLine ?? '', kind: 'add' });
    }
  }
  return rows;
}

interface DiffColumnProps {
  title: string;
  rows: DiffRow[];
  side: 'published' | 'draft';
}

function DiffColumn({ title, rows, side }: DiffColumnProps) {
  return (
    <div className="diff-column">
      <h3>{title}</h3>
      <div className="diff-body">
        {rows.map((row, index) => {
          if (side === 'published') {
            if (row.kind === 'add') return null;
            return row.kind === 'remove' ? <del key={index}>{row.text}</del> : <p key={index}>{row.text}</p>;
          }
          if (row.kind === 'remove') return null;
          return row.kind === 'add' ? <ins key={index}>{row.text}</ins> : <p key={index}>{row.text}</p>;
        })}
      </div>
    </div>
  );
}

export function ApprovalQueuePage() {
  const { approvals, refreshApprovals } = useWorkspace();
  const [tab, setTab] = useState<'review' | 'decided'>('review');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingComment, setMissingComment] = useState(false);

  const decidedState = useApi(() => decidedApprovals(20), []);
  const decided = decidedState.data ?? [];

  const selected: PendingApprovalItem | null =
    approvals.find((item) => item.versionId === selectedVersionId) ?? approvals[0] ?? null;

  const detailState = useApi(
    () => (selected ? sopDetail(selected.sopId) : Promise.resolve(null)),
    [selected?.sopId, selected?.versionId],
  );
  const detail: SopDetailResponse | null = detailState.data;

  const publishedVersion: SopVersion | null =
    detail?.versions.find((version) => version.status === 'published') ?? null;
  const pendingVersion: SopVersion | null = selected
    ? (detail?.versions.find((version) => version.id === selected.versionId) ?? null)
    : null;
  const rows = diff(splitLines(publishedVersion?.bodyContent), splitLines(pendingVersion?.bodyContent));

  async function handleDecision(decision: ApprovalDecision) {
    if (!selected) return;
    const trimmed = comment.trim();
    if (decision === 'rejected' && !trimmed) {
      setMissingComment(true);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await decideOnVersion(selected.versionId, {
        decision,
        comment: trimmed || undefined,
      });
      refreshApprovals();
      decidedState.reload();
      setSelectedVersionId(null);
      setRejectMode(false);
      setComment('');
      setMissingComment(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-wrap">
      <div className="screen-title">
        <div>
          <p className="eyebrow">APPROVAL WORKFLOW</p>
          <h1>Approval queue</h1>
          <p>Review what changed before a new version becomes official.</p>
        </div>
        <StatusBadge status="pending_approval" />
      </div>

      <div className="queue-toolbar">
        <div className="tabs">
          <button className={`tab${tab === 'review' ? ' active' : ''}`} type="button" onClick={() => setTab('review')}>
            Needs my review <b>{approvals.length}</b>
          </button>
          <button className={`tab${tab === 'decided' ? ' active' : ''}`} type="button" onClick={() => setTab('decided')}>
            Recently decided <b>{decided.length}</b>
          </button>
        </div>
        <span className="sort-button">Newest first ▾</span>
      </div>

      {tab === 'review' ? (
        approvals.length === 0 ? (
          <div className="detail-card state-panel">Nothing waiting for your review. Nice work.</div>
        ) : (
          <div className="queue-list">
            {approvals.map((item) => {
              const isSelected = selected?.versionId === item.versionId;
              const tone = toneFor(item.departmentId);
              return (
                <button
                  key={item.versionId}
                  type="button"
                  className="queue-card"
                  style={{
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderColor: isSelected ? '#bcdbd3' : undefined,
                  }}
                  onClick={() => {
                    setSelectedVersionId(item.versionId);
                    setRejectMode(false);
                    setComment('');
                    setError(null);
                    setMissingComment(false);
                  }}
                >
                  <div className="queue-icon">{TONE_GLYPH[tone]}</div>
                  <div className="queue-copy">
                    <h3>{item.title}</h3>
                    <p>
                      {item.submittedByName} · {item.departmentName} · Submitted{' '}
                      {formatRelativeTime(item.submittedAt)}
                    </p>
                    <div className="queue-copy-meta">
                      <StatusBadge status="pending_approval" />
                      <span>{versionLabel(item.versionNumber)}</span>
                    </div>
                  </div>
                  <span className="status pending">Pending</span>
                  <Icon name="chevron" />
                </button>
              );
            })}
          </div>
        )
      ) : decidedState.status === 'error' ? (
        <ErrorPanel message={decidedState.error ?? 'Failed to load decisions'} onRetry={decidedState.reload} />
      ) : decidedState.status === 'loading' && decided.length === 0 ? (
        <LoadingPanel label="Loading decisions…" />
      ) : decided.length === 0 ? (
        <div className="detail-card state-panel">No decisions recorded yet.</div>
      ) : (
        <div className="queue-list">
          {decided.map((item) => {
            const tone = toneFor(item.departmentId);
            return (
              <div key={item.id} className="queue-card">
                <div className="queue-icon">{TONE_GLYPH[tone]}</div>
                <div className="queue-copy">
                  <h3>
                    {item.title} · {versionLabel(item.versionNumber)}
                  </h3>
                  <p>{item.comment ?? 'No comment'}</p>
                  <div className="queue-copy-meta">
                    <span className={`status ${item.decision === 'approved' ? 'published' : 'rejected'}`}>
                      {item.decision === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                    <span>
                      {formatRelativeTime(item.decidedAt)} · by {item.approverName}
                    </span>
                  </div>
                </div>
                <span className="status pending" />
                <Icon name="chevron" />
              </div>
            );
          })}
        </div>
      )}

      {tab === 'review' && selected && (
        <>
          <div className="screen-title" style={{ marginTop: 42, marginBottom: 18 }}>
            <div>
              <p className="eyebrow">SELECTED DRAFT</p>
              <h1 style={{ fontSize: 20 }}>{selected.title}</h1>
            </div>
            <Link className="text-link" to={`/sops/${selected.sopId}`}>
              Open SOP detail →
            </Link>
          </div>

          {detailState.status === 'error' ? (
            <ErrorPanel message={detailState.error ?? 'Failed to load the draft'} onRetry={detailState.reload} />
          ) : !detail ? (
            <LoadingPanel label="Loading the comparison…" />
          ) : (
            <div className="review-layout" id="review">
              <section className="diff-card">
                <div className="diff-header">
                  <h2>Compare changes</h2>
                  <span className="compare-label">
                    {publishedVersion
                      ? `Published ${versionLabel(publishedVersion.versionNumber)} → Draft ${versionLabel(pendingVersion?.versionNumber ?? selected.versionNumber)}`
                      : `New SOP → Draft ${versionLabel(pendingVersion?.versionNumber ?? selected.versionNumber)}`}
                  </span>
                </div>
                <div className="diff-grid">
                  <DiffColumn
                    title={
                      publishedVersion
                        ? `Published version · ${versionLabel(publishedVersion.versionNumber)}`
                        : 'No published version yet'
                    }
                    rows={rows}
                    side="published"
                  />
                  <DiffColumn
                    title={`Draft version · ${versionLabel(pendingVersion?.versionNumber ?? selected.versionNumber)}`}
                    rows={rows}
                    side="draft"
                  />
                </div>
              </section>

              <aside className="review-side">
                <section className="detail-card">
                  <h2>Approver decision</h2>
                  <div className="reviewer">
                    <Avatar
                      initials={initialsOf(selected.submittedByName)}
                      color={colorForUser(selected.submittedById)}
                    />
                    <div>
                      <strong>{selected.submittedByName}</strong>
                      <span>
                        {selected.departmentName} · Submitted {formatRelativeTime(selected.submittedAt)}
                      </span>
                    </div>
                  </div>
                  <p className="detail-card-p" style={{ marginTop: 12 }}>
                    Change summary: {selected.changeSummary ?? '—'}
                  </p>

                  {rejectMode && (
                    <textarea
                      className="fake-editor"
                      style={{ minHeight: 90 }}
                      value={comment}
                      onChange={(event) => {
                        setComment(event.target.value);
                        setMissingComment(false);
                      }}
                      placeholder="Explain why this draft is rejected (required)"
                      aria-label="Rejection comment"
                    />
                  )}
                  {missingComment && <p className="hint-inline">A comment is required to reject a draft.</p>}
                  {error && <p className="hint-inline">{error}</p>}

                  <Button onClick={() => handleDecision('approved')} disabled={busy}>
                    {busy ? 'Working…' : 'Approve & publish'}
                  </Button>
                  {rejectMode ? (
                    <Button variant="reject" onClick={() => handleDecision('rejected')} disabled={busy}>
                      Confirm rejection
                    </Button>
                  ) : (
                    <Button variant="reject" onClick={() => setRejectMode(true)} disabled={busy}>
                      Reject with comment
                    </Button>
                  )}
                </section>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
