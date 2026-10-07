import { Link, useParams } from 'react-router';
import { assetUrl } from '../api/client';
import { sopDetail } from '../api/endpoints';
import { useApi } from '../api/hooks';
import { StatusBadge, VersionBadge } from '../components/Badge';
import { ButtonLink } from '../components/Button';
import { FlowDiagram } from '../components/FlowDiagram';
import { Icon } from '../components/Icon';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import { formatDate, formatRelativeTime, splitLines, versionLabel } from '../lib/display';
import type { DiagramNode } from '../types';

function renderBody(content: string) {
  const steps: string[] = [];
  const prose: Array<{ line: string; heading: boolean }> = [];

  splitLines(content).forEach((line) => {
    if (!line.trim()) return;
    const stepMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (stepMatch) {
      steps.push(stepMatch[2]);
      return;
    }
    const isHeading = line.length <= 40 && line === line.toUpperCase();
    prose.push({ line, heading: isHeading });
  });

  return (
    <>
      {prose.map((entry, index) =>
        entry.heading ? <h3 key={index}>{entry.line}</h3> : <p key={index}>{entry.line}</p>,
      )}
      {steps.length > 0 && (
        <ol>
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      )}
    </>
  );
}

export function SopDetailPage() {
  const { sopId } = useParams();
  const state = useApi(() => sopDetail(sopId ?? ''), [sopId]);

  if (!sopId) {
    return (
      <div className="page-wrap">
        <ErrorPanel message="This SOP could not be found." />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="page-wrap">
        <ErrorPanel message={state.error ?? 'Failed to load the SOP'} onRetry={state.reload} />
      </div>
    );
  }

  if (!state.data) {
    return (
      <div className="page-wrap">
        <LoadingPanel label="Loading the SOP…" />
      </div>
    );
  }

  const detail = state.data;
  const published = detail.versions.find((version) => version.status === 'published');
  const shown = published ?? detail.versions[0];

  if (!shown) {
    return (
      <div className="page-wrap">
        <ErrorPanel message="This SOP has no versions yet." />
      </div>
    );
  }

  const diagramNodes = (shown.diagramData as DiagramNode[] | null) ?? [];
  const diagramImage = assetUrl(shown.diagramFileUrl);
  const approval = detail.approvals.find(
    (record) => record.sopVersionId === shown.id && record.decision === 'approved',
  );
  const timeline = detail.changeLog.slice(0, 3);

  return (
    <div className="page-wrap">
      <Link className="back-link" to="/search">
        ← Back to SOP library
      </Link>

      <div className="sop-hero">
        <div>
          <div className="sop-heading">
            <h1>{detail.sop.title}</h1>
            <VersionBadge status={shown.status} version={versionLabel(shown.versionNumber)} />
          </div>
          <div className="sop-meta">
            <span>{detail.sop.departmentName}</span>
            <b>·</b>
            <span>Owner: {detail.sop.ownerName}</span>
            <b>·</b>
            <span>Updated {formatRelativeTime(shown.updatedAt)}</span>
          </div>
        </div>
        <div className="sop-actions">
          <ButtonLink to="/history" variant="secondary">
            <Icon name="history" size={15} /> Version history
          </ButtonLink>
          <ButtonLink to={`/sops/${detail.sop.id}/edit`}>Edit SOP</ButtonLink>
        </div>
      </div>

      <div className="sop-detail-grid">
        <div>
          <section className="detail-card diagram-card">
            <h2>Process flow</h2>
            {diagramNodes.length > 0 ? (
              <FlowDiagram nodes={diagramNodes} variant="detail" />
            ) : diagramImage ? (
              <img className="diagram-image" src={diagramImage} alt={`Process diagram for ${detail.sop.title}`} />
            ) : (
              <div className="state-panel" style={{ padding: '60px 20px' }}>
                No diagram attached yet.
              </div>
            )}
            <div className="flow-caption">
              <span>
                {diagramNodes.length > 0
                  ? `Simple process diagram · ${diagramNodes.length} shapes`
                  : diagramImage
                    ? 'Uploaded diagram file'
                    : 'Diagram pending'}
              </span>
              <span>
                {shown.status === 'published' ? 'Published diagram' : `${shown.status.replace('_', ' ')} diagram`}
              </span>
            </div>
          </section>

          <section className="detail-card" style={{ marginTop: 15 }}>
            <h2>Procedure</h2>
            <div className="body-copy">{renderBody(shown.bodyContent ?? '')}</div>
          </section>
        </div>

        <aside>
          <section className="detail-card">
            <h2>Document details</h2>
            <dl className="info-list">
              <div>
                <dt>Department</dt>
                <dd>{detail.sop.departmentName}</dd>
              </div>
              <div>
                <dt>Current version</dt>
                <dd>
                  {versionLabel(shown.versionNumber)} · <StatusBadge status={shown.status} />
                </dd>
              </div>
              <div>
                <dt>Created by</dt>
                <dd>{detail.sop.ownerName}</dd>
              </div>
              <div>
                <dt>Approved by</dt>
                <dd>{approval ? approval.approverName : '—'}</dd>
              </div>
              <div>
                <dt>Approved on</dt>
                <dd>{approval ? formatDate(approval.decidedAt) : '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-card history-mini">
            <h2>Recent changes</h2>
            {timeline.map((entry) => (
              <div key={entry.id} className="timeline-item">
                <span className="timeline-dot" />
                <div className="timeline-copy">
                  <strong>{entry.changedByName}</strong>
                  <span>
                    {entry.changeSummary} · {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <p style={{ margin: 0, color: '#9ca8b8', fontSize: 11 }}>No changes recorded yet.</p>
            )}
            <Link className="text-link" style={{ display: 'block', marginTop: 17 }} to="/history">
              See full version history →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
