import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { uploadDiagram } from '../api/client';
import { sopDetail, updateVersion } from '../api/endpoints';
import { useApi } from '../api/hooks';
import { Button } from '../components/Button';
import { FlowDiagram } from '../components/FlowDiagram';
import { ErrorPanel, LoadingPanel } from '../components/StatePanels';
import type { DiagramNode, DiagramNodeKind, DiagramSlot, SopVersion } from '../types';

interface ShapeTool {
  key: DiagramNodeKind;
  label: string;
  symbolClass: 'round' | 'square' | 'diamond';
  symbol: string;
}

const SHAPES: ShapeTool[] = [
  { key: 'start', label: 'Start', symbolClass: 'round', symbol: '●' },
  { key: 'task', label: 'Task', symbolClass: 'square', symbol: '□' },
  { key: 'decision', label: 'Decision', symbolClass: 'diamond', symbol: '◇' },
  { key: 'end', label: 'End', symbolClass: 'round', symbol: '■' },
];

const AVAILABLE_SLOTS: DiagramSlot[] = ['task-one', 'task-two', 'task-three'];
const TASK_LABELS = ['Submit', 'Review', 'Approve', 'Verify', 'Update'];

const STARTER_NODES: DiagramNode[] = [
  { id: 'n1', kind: 'start', label: 'Start', slot: 'start' },
  { id: 'n2', kind: 'task', label: 'Submit', slot: 'task-one' },
  { id: 'n3', kind: 'decision', label: 'OK?', slot: 'decision' },
  { id: 'n4', kind: 'task', label: 'Review', slot: 'task-two' },
  { id: 'n5', kind: 'end', label: 'End', slot: 'end' },
];

let nextId = 100;

export function DiagramEditorPage() {
  const { sopId } = useParams();
  const navigate = useNavigate();

  const detailState = useApi(() => (sopId ? sopDetail(sopId) : Promise.resolve(null)), [sopId]);
  const detail = detailState.data;
  const draft = detail?.versions.find((version) => version.status === 'draft') ?? null;

  if (detailState.status === 'error') {
    return (
      <div className="page-wrap">
        <ErrorPanel message={detailState.error ?? 'Failed to load the SOP'} onRetry={detailState.reload} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="page-wrap">
        <LoadingPanel label="Loading the diagram…" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="page-wrap">
        <div className="detail-card state-panel">
          <p style={{ margin: 0 }}>
            This SOP has no editable draft. Start a new draft version in the draft editor first.
          </p>
          <Link className="button button-primary" to={`/sops/${sopId}/edit`} style={{ marginTop: 14 }}>
            Open draft editor
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DiagramEditorSession
      key={draft.id}
      sopId={detail.sop.id}
      sopTitle={detail.sop.title}
      draft={draft}
      onBack={() => navigate(-1)}
    />
  );
}

interface DiagramEditorSessionProps {
  sopId: string;
  sopTitle: string;
  draft: SopVersion;
  onBack: () => void;
}

function DiagramEditorSession({ sopId, sopTitle, draft, onBack }: DiagramEditorSessionProps) {
  const [nodes, setNodes] = useState<DiagramNode[]>(
    () => (draft.diagramData as DiagramNode[] | null) ?? STARTER_NODES,
  );
  const [fileName, setFileName] = useState<string | null>(() =>
    draft.diagramFileUrl ? (draft.diagramFileUrl.split('/').pop() ?? null) : null,
  );
  const [zoom, setZoom] = useState(100);
  const [busy, setBusy] = useState<'save' | 'upload' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function handleSave() {
    setBusy('save');
    setError(null);
    setNote(null);
    try {
      await updateVersion(sopId, draft.id, {
        diagramData: nodes,
        changeSummary: 'Updated process diagram',
      });
      setNote('Diagram saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save the diagram');
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload(file: File) {
    setBusy('upload');
    setError(null);
    setNote(null);
    try {
      const stored = await uploadDiagram(file);
      await updateVersion(sopId, draft.id, {
        diagramFileUrl: stored.url,
        changeSummary: `Uploaded diagram ${file.name}`,
      });
      setFileName(file.name);
      setNote('Diagram uploaded.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  }

  function addShape(kind: DiagramNodeKind) {
    if (kind === 'start' || kind === 'end') {
      if (nodes.some((node) => node.kind === kind)) return;
      setNodes([
        ...nodes,
        { id: `node-${nextId++}`, kind, label: kind === 'start' ? 'Start' : 'End', slot: kind },
      ]);
      return;
    }
    if (kind === 'decision') {
      if (nodes.some((node) => node.kind === 'decision')) return;
      setNodes([...nodes, { id: `node-${nextId++}`, kind, label: 'Decision?', slot: 'decision' }]);
      return;
    }
    const usedSlots = new Set(nodes.map((node) => node.slot));
    const slot = AVAILABLE_SLOTS.find((candidate) => !usedSlots.has(candidate));
    if (!slot) return;
    const label = TASK_LABELS[nodes.length % TASK_LABELS.length];
    setNodes([...nodes, { id: `node-${nextId++}`, kind, label, slot }]);
  }

  return (
    <div className="page-wrap">
      <div className="screen-title">
        <div>
          <p className="eyebrow">SOP EDITOR · STEP 2 OF 2</p>
          <h1>Build your process flow</h1>
          <p>Use simple shapes to make the process easy to follow.</p>
        </div>
        <div className="title-actions">
          <Button variant="secondary" onClick={onBack}>
            ← Back to draft
          </Button>
          <Button onClick={handleSave} disabled={busy !== null}>
            {busy === 'save' ? 'Saving…' : 'Save diagram'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="hint-inline" style={{ marginBottom: 12 }}>
          {error}
        </p>
      )}
      {note && (
        <p className="detail-card-p" style={{ marginBottom: 12, color: '#24987e' }}>
          {note}
        </p>
      )}

      <div className="editor-layout">
        <section className="editor-card">
          <div className="editor-toolbar">
            <h2>
              {sopTitle} · Draft v{draft.versionNumber}
            </h2>
            <div className="zoom-control">
              <button type="button" onClick={() => setZoom((value) => Math.max(75, value - 10))}>−</button>
              <span>{zoom}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(125, value + 10))}>+</button>
            </div>
          </div>
          <FlowDiagram nodes={nodes} variant="editor" zoom={zoom / 100} />
          <div className="flow-caption">
            <span>Drag shapes to reposition · Connect nodes by their handles</span>
            <span>{nodes.length} shapes</span>
          </div>
        </section>

        <aside className="editor-tools">
          <h3>Shape palette</h3>
          <p className="tool-label">Add a shape</p>
          {SHAPES.map((shape) => (
            <button key={shape.key} className="shape-tool" type="button" onClick={() => addShape(shape.key)}>
              <span className={`shape-symbol ${shape.symbolClass}`}>
                {shape.symbolClass === 'diamond' ? <span>{shape.symbol}</span> : shape.symbol}
              </span>
              {shape.label}
            </button>
          ))}
          <p className="tool-label">Other</p>
          <span className="shape-tool" style={{ cursor: 'default' }}>
            <span className="shape-symbol">T</span>
            Text annotation
          </span>
          <div className="upload-box">
            <strong>{fileName ?? 'Upload existing diagram'}</strong>
            <span>PNG, JPG, or PDF · max 10 MB</span>
            <label className="text-link" style={{ display: 'inline-block', marginTop: 10, cursor: 'pointer' }}>
              {busy === 'upload' ? 'Uploading…' : 'Choose file'}
              <input
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                style={{ display: 'none' }}
                disabled={busy !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUpload(file);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          {nodes.length > 6 && (
            <div className="chip-list" aria-live="polite">
              <span className="chip">+{nodes.length - 6} shapes added</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
