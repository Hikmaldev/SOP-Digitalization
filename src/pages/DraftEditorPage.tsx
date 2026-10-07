import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import {
  createDraftVersion,
  createSop,
  sopDetail,
  submitVersion,
  updateSop,
  updateVersion,
} from '../api/endpoints';
import { useApi } from '../api/hooks';
import { StatusBadge } from '../components/Badge';
import { Button, ButtonLink } from '../components/Button';
import { FlowDiagram } from '../components/FlowDiagram';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import { useAuth } from '../context/auth-context';
import { useWorkspace } from '../context/workspace-context';
import { STATUS_LABEL } from '../lib/display';
import type { DiagramNode, SopDetailResponse, SopVersion } from '../types';

type BusyState = null | 'save' | 'submit' | 'draft' | 'continue';

/**
 * Outer shell: loads the SOP (when editing) and keys the form session on the
 * active draft, so the form resets naturally when a new draft version starts.
 */
export function DraftEditorPage() {
  const { sopId } = useParams();
  const isNew = !sopId;

  const detailState = useApi(() => (sopId ? sopDetail(sopId) : Promise.resolve(null)), [sopId]);
  const detail = detailState.data;

  if (!isNew && detailState.status === 'error') {
    return (
      <div className="page-wrap">
        <ErrorPanel message={detailState.error ?? 'Failed to load the SOP'} onRetry={detailState.reload} />
      </div>
    );
  }

  if (!isNew && !detail) {
    return (
      <div className="page-wrap">
        <LoadingPanel label="Loading the SOP…" />
      </div>
    );
  }

  const draft = detail?.versions.find((version) => version.status === 'draft') ?? null;
  const sessionKey = isNew ? 'new' : (draft?.id ?? detail?.sop.id ?? 'sop');

  return (
    <DraftEditorSession
      key={sessionKey}
      sopId={sopId ?? null}
      detail={detail}
      draft={draft}
      onRefresh={detailState.reload}
    />
  );
}

interface DraftEditorSessionProps {
  sopId: string | null;
  detail: SopDetailResponse | null;
  draft: SopVersion | null;
  onRefresh: () => void;
}

function DraftEditorSession({ sopId, detail, draft, onRefresh }: DraftEditorSessionProps) {
  const isNew = sopId === null;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { departments, refreshApprovals } = useWorkspace();

  const [title, setTitle] = useState(detail?.sop.title ?? '');
  const [departmentId, setDepartmentId] = useState(detail?.sop.departmentId ?? '');
  const [bodyContent, setBodyContent] = useState(
    draft?.bodyContent ?? detail?.versions[0]?.bodyContent ?? '',
  );
  const [changeSummary, setChangeSummary] = useState('Updated content');
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const justSaved = Boolean((location.state as { saved?: boolean } | null)?.saved);
  const resolvedDepartmentId = departmentId || departments[0]?.id || '';
  const shown = detail?.versions.find((version) => version.status === 'published') ?? detail?.versions[0] ?? null;
  const canEdit = isNew || Boolean(draft);

  async function handleStartDraft() {
    if (!sopId) return;
    setBusy('draft');
    setError(null);
    try {
      await createDraftVersion(sopId, { changeSummary: changeSummary.trim() || 'Updated content' });
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to start a draft');
    } finally {
      setBusy(null);
    }
  }

  /** Create or update the record; returns the ids needed for follow-up actions. */
  async function persistDraft(): Promise<{ sopId: string; versionId: string }> {
    if (title.trim().length < 3) throw new Error('The SOP title must be at least 3 characters');
    if (!resolvedDepartmentId) throw new Error('Choose a department first');

    if (isNew) {
      const created = await createSop({
        title: title.trim(),
        departmentId: resolvedDepartmentId,
        bodyContent,
        changeSummary: 'Created SOP draft',
      });
      return { sopId: created.sop.id, versionId: created.draft.id };
    }

    if (!sopId || !draft) throw new Error('Start a new draft version before saving');
    await updateSop(sopId, { title: title.trim(), departmentId: resolvedDepartmentId });
    await updateVersion(sopId, draft.id, {
      bodyContent,
      changeSummary: 'Updated draft content',
    });
    return { sopId, versionId: draft.id };
  }

  async function handleSave() {
    setBusy('save');
    setError(null);
    setNote(null);
    try {
      const saved = await persistDraft();
      if (isNew) {
        navigate(`/sops/${saved.sopId}/edit`, { replace: true, state: { saved: true } });
        return;
      }
      setNote('Draft saved.');
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save the draft');
    } finally {
      setBusy(null);
    }
  }

  async function handleContinueToDiagram() {
    setBusy('continue');
    setError(null);
    try {
      const saved = await persistDraft();
      navigate(`/sops/${saved.sopId}/diagram`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save the draft');
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    setBusy('submit');
    setError(null);
    setNote(null);
    try {
      const saved = await persistDraft();
      await submitVersion(saved.sopId, saved.versionId);
      refreshApprovals();

      if (isNew) {
        navigate(`/sops/${saved.sopId}`, { replace: true });
        return;
      }
      setSubmitted(true);
      onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to submit for approval');
    } finally {
      setBusy(null);
    }
  }

  const diagramAttached = Boolean(draft?.diagramData || draft?.diagramFileUrl);
  const checklist = [
    { label: 'Title and department added', complete: title.trim().length >= 3 && Boolean(resolvedDepartmentId) },
    {
      label: 'Procedure content included',
      complete: bodyContent.trim().length > 10 || diagramAttached,
    },
    { label: 'Process diagram attached', complete: diagramAttached },
  ];
  const allReady = checklist.slice(0, 2).every((item) => item.complete);

  return (
    <div className="page-wrap">
      <div className="screen-title">
        <div>
          <p className="eyebrow">
            {isNew
              ? 'CREATE NEW SOP · STEP 1 OF 2'
              : `EDIT SOP · ${draft ? `DRAFT v${draft.versionNumber}` : 'NO ACTIVE DRAFT'}`}
          </p>
          <h1>{isNew ? 'Document a process' : 'Update the SOP'}</h1>
          <p>Give your team one clear, current source of truth.</p>
        </div>
        <div className="title-actions">
          <Button variant="secondary" onClick={handleSave} disabled={!canEdit || busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save as draft'}
          </Button>
          <Button onClick={handleContinueToDiagram} disabled={!canEdit || busy !== null}>
            {busy === 'continue' ? 'Saving…' : 'Continue to diagram →'}
          </Button>
        </div>
      </div>

      {submitted || justSaved || note ? (
        <div className="detail-card" style={{ marginBottom: 15 }}>
          <h2>{submitted ? 'Draft is now pending review ✓' : 'Saved ✓'}</h2>
          <p className="detail-card-p">
            {submitted ? (
              <>
                It will not appear in search until an approver publishes it.{' '}
                <Link className="text-link" to="/">
                  Back to overview →
                </Link>
              </>
            ) : (
              'Your changes are stored on the server. Continue to the diagram editor or submit for approval when ready.'
            )}
          </p>
        </div>
      ) : null}

      {!isNew && detail && !draft && (
        <div className="detail-card" style={{ marginBottom: 15 }}>
          <h2>Start a new draft version</h2>
          <p className="detail-card-p">
            This SOP is currently “{shown ? STATUS_LABEL[shown.status] : 'unknown'}”. Editing creates a new
            draft version — the published version stays live and unchanged until the draft is approved.
          </p>
          <div className="start-draft-row">
            <input
              className="input"
              value={changeSummary}
              onChange={(event) => setChangeSummary(event.target.value)}
              placeholder="What are you changing?"
            />
            <Button onClick={handleStartDraft} disabled={busy !== null}>
              {busy === 'draft' ? 'Starting…' : 'Start draft'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="hint-inline" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}

      <div className="form-layout">
        <section className="form-card">
          <div className="form-section">
            <h2>Basic information</h2>
            <div className="field-grid">
              <div className="field full">
                <label htmlFor="sop-title">SOP title</label>
                <input
                  id="sop-title"
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. New employee onboarding"
                  disabled={!canEdit}
                />
              </div>
              <div className="field">
                <label htmlFor="sop-department">Department</label>
                <select
                  id="sop-department"
                  className="select"
                  value={resolvedDepartmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  disabled={!canEdit}
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sop-owner">Process owner</label>
                <input
                  id="sop-owner"
                  className="input"
                  value={detail?.sop.ownerName ?? user?.fullName ?? ''}
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Procedure content</h2>
            <div className="field full">
              <label htmlFor="sop-body">Body content</label>
              <div className="editor-format" aria-hidden="true">
                <button className="format-button" type="button"><b>B</b></button>
                <button className="format-button" type="button"><i>I</i></button>
                <button className="format-button" type="button">• list</button>
                <button className="format-button" type="button">1. list</button>
                <button className="format-button" type="button">↗</button>
              </div>
              <textarea
                id="sop-body"
                className="fake-editor"
                value={bodyContent}
                onChange={(event) => setBodyContent(event.target.value)}
                placeholder={'Purpose\nDescribe why this process exists.\n\nSteps\n1. First step\n2. Second step'}
                disabled={!canEdit}
              />
              <small>
                Use structured steps and plain language so employees can follow the procedure without training.
              </small>
            </div>
          </div>

          <div className="form-section">
            <h2>Process diagram</h2>
            {draft && ((draft.diagramData as DiagramNode[] | null) ?? []).length > 0 ? (
              <FlowDiagram nodes={draft.diagramData as DiagramNode[]} variant="embed" />
            ) : draft?.diagramFileUrl ? (
              <p className="detail-card-p" style={{ margin: 0 }}>
                Uploaded diagram attached: <code>{draft.diagramFileUrl}</code>
              </p>
            ) : (
              <div className="state-panel" style={{ padding: '40px 20px' }}>
                No diagram yet — build one or upload an existing file.
              </div>
            )}
            <div className="diagram-actions">
              <span className="diagram-hint">You can build a diagram or upload an existing file.</span>
              {canEdit && detail ? (
                <Link className="text-link" to={`/sops/${detail.sop.id}/diagram`}>
                  Open diagram editor →
                </Link>
              ) : isNew ? (
                <span className="diagram-hint">Save the draft first to open the diagram editor.</span>
              ) : null}
            </div>
          </div>
        </section>

        <aside>
          <section className="form-sidebar-card">
            <h3>Submission checklist</h3>
            {checklist.map((item) => (
              <div key={item.label} className="check-row">
                <span className={`check${item.complete ? '' : ' off'}`}>✓</span>
                <span>{item.label}</span>
              </div>
            ))}
          </section>

          <section className="form-sidebar-card submit-card">
            <h3>Ready to submit?</h3>
            <p>
              {!isNew && !draft
                ? 'Start a new draft version first — then it can be submitted for approval.'
                : 'Submitting sends this draft to the approver. It will not appear in search until it is approved.'}
            </p>
            <Button disabled={!canEdit || !allReady || busy !== null || submitted} onClick={handleSubmit}>
              {busy === 'submit' ? 'Submitting…' : submitted ? 'Submitted ✓' : 'Submit for approval'}
            </Button>
            {!allReady && (
              <p className="hint-inline">Complete the checklist above before submitting.</p>
            )}
          </section>

          <section className="form-sidebar-card">
            <h3>Current status</h3>
            <div className="review-meta">
              <StatusBadge status={draft ? 'draft' : (shown?.status ?? 'draft')} />
              <span>
                {draft
                  ? `draft v${draft.versionNumber}`
                  : shown
                    ? `${STATUS_LABEL[shown.status]} v${shown.versionNumber}`
                    : 'new SOP'}
              </span>
            </div>
          </section>

          {!isNew && (
            <section className="form-sidebar-card">
              <h3>View this SOP</h3>
              <ButtonLink to={`/sops/${sopId}`} variant="secondary" className="block-button">
                Open detail page
              </ButtonLink>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
