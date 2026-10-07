import { useId, useLayoutEffect, useMemo, useRef } from 'react';
import type { DiagramNode, DiagramSlot } from '../types';

/**
 * Renders a simplified process flow diagram using the CSS shape system.
 * The MVP editor supports exactly four shape kinds (start, task, decision,
 * end) per the design doc — no BPMN engine required.
 *
 * Connectors are NOT hard-coded: every edge is drawn from the measured edge
 * of the source node to the measured edge of the target node, so lines are
 * always continuous (no dangling segments) no matter which slots exist.
 * Arrows show flow direction; decision branches carry Yes/No labels.
 */

const SLOT_CLASS: Record<DiagramSlot, string> = {
  start: 'start',
  'task-one': 'task-one',
  decision: 'decision',
  'task-two': 'task-two',
  'task-three': 'task-three',
  end: 'end',
};

type Variant = 'detail' | 'embed' | 'editor';

interface FlowDiagramProps {
  nodes: DiagramNode[];
  variant?: Variant;
  zoom?: number;
}

/** Slots that form the straight reading line of the flow, in order. */
const CHAIN: DiagramSlot[] = ['start', 'task-one', 'decision'];

interface FlowEdge {
  id: string;
  from: DiagramSlot;
  to: DiagramSlot;
  label?: 'Yes' | 'No';
}

/** Derive the connector list purely from the slots that actually exist. */
function buildEdges(nodes: DiagramNode[]): FlowEdge[] {
  const present = new Set(nodes.map((node) => node.slot));
  const edges: FlowEdge[] = [];
  const chain = CHAIN.filter((slot) => present.has(slot));

  for (let index = 0; index < chain.length - 1; index += 1) {
    edges.push({ id: `chain-${index}`, from: chain[index], to: chain[index + 1] });
  }

  const hasDecision = present.has('decision');
  const hasTaskTwo = present.has('task-two');
  const hasTaskThree = present.has('task-three');
  const hasEnd = present.has('end');

  if (hasDecision) {
    if (hasTaskTwo) edges.push({ id: 'branch-yes', from: 'decision', to: 'task-two', label: 'Yes' });
    if (hasTaskThree) edges.push({ id: 'branch-no', from: 'decision', to: 'task-three', label: 'No' });
  } else if (hasTaskTwo) {
    const source = chain[chain.length - 1];
    if (source) edges.push({ id: 'to-two', from: source, to: 'task-two' });
  } else if (hasTaskThree) {
    const source = chain[chain.length - 1];
    if (source) edges.push({ id: 'to-three', from: source, to: 'task-three' });
  }

  // The flow re-converges into "end": main path plus the "No" branch.
  const sink: DiagramSlot | null = hasTaskTwo
    ? 'task-two'
    : hasDecision
      ? 'decision'
      : (chain[chain.length - 1] ?? null);
  if (hasEnd && sink) edges.push({ id: 'to-end', from: sink, to: 'end' });
  if (hasEnd && hasTaskThree) edges.push({ id: 'to-end-three', from: 'task-three', to: 'end' });

  return edges;
}

type EdgeKind = 'main' | 'yes' | 'no';

function edgeKind(edge: FlowEdge): EdgeKind {
  if (edge.label === 'Yes') return 'yes';
  if (edge.label === 'No') return 'no';
  return 'main';
}

interface Point {
  x: number;
  y: number;
}

const ARROW_LENGTH = 6; // px of arrowhead in SVG user units

export function FlowDiagram({ nodes, variant = 'detail', zoom = 1 }: FlowDiagramProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<DiagramSlot, HTMLElement>());
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const labelRefs = useRef(new Map<string, HTMLSpanElement>());
  const markerId = useId().replace(/:/g, '');

  const edges = useMemo(() => buildEdges(nodes), [nodes]);

  const canvasClass =
    variant === 'editor'
      ? 'diagram-canvas large-canvas'
      : variant === 'embed'
        ? 'diagram-canvas embedded-diagram'
        : 'diagram-canvas';

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || edges.length === 0) return;

    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect();

      const centerOf = (slot: DiagramSlot): Point | null => {
        const element = nodeRefs.current.get(slot);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          x: box.left + box.width / 2 - canvasRect.left,
          y: box.top + box.height / 2 - canvasRect.top,
        };
      };

      const halfOf = (slot: DiagramSlot): { w: number; h: number } | null => {
        const element = nodeRefs.current.get(slot);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { w: box.width / 2, h: box.height / 2 };
      };

      // Entry/exit point on a node's boundary along a unit direction.
      const boundaryPoint = (
        slot: DiagramSlot,
        dir: Point,
        sign: 1 | -1,
      ): Point | null => {
        const center = centerOf(slot);
        const half = halfOf(slot);
        if (!center || !half) return null;
        const extent = Math.abs(dir.x) * half.w + Math.abs(dir.y) * half.h;
        return { x: center.x + dir.x * sign * extent, y: center.y + dir.y * sign * extent };
      };

      for (const edge of edges) {
        const from = centerOf(edge.from);
        const to = centerOf(edge.to);
        const path = pathRefs.current.get(edge.id);
        if (!from || !to || !path) continue;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy) || 1;
        const unit = { x: dx / distance, y: dy / distance };

        const exit = boundaryPoint(edge.from, unit, 1);
        const entry = boundaryPoint(edge.to, unit, -1);
        if (!exit || !entry) continue;

        // Pull the arrow tip back so it lands just at the node border.
        const tip = {
          x: entry.x - unit.x * ARROW_LENGTH,
          y: entry.y - unit.y * ARROW_LENGTH,
        };

        const bend = (tip.x - exit.x) * 0.45;
        const d = `M ${exit.x.toFixed(1)} ${exit.y.toFixed(1)} C ${(exit.x + bend).toFixed(1)} ${exit.y.toFixed(1)} ${(tip.x - bend).toFixed(1)} ${tip.y.toFixed(1)} ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`;
        path.setAttribute('d', d);

        if (edge.label) {
          const label = labelRefs.current.get(edge.id);
          if (label) {
            const midX = (exit.x + tip.x) / 2;
            const midY = (exit.y + tip.y) / 2;
            const offsetX = edge.label === 'Yes' ? 7 : 5;
            const offsetY = edge.label === 'Yes' ? -9 : 11;
            label.style.transform = `translate(${midX + offsetX}px, ${midY + offsetY}px)`;
            label.style.opacity = '1';
          }
        }
      }
    };

    measure();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure());
      observer.observe(canvas);
    }

    // Re-measure once custom fonts settle so labels aren't misplaced.
    try {
      void document.fonts.ready.then(() => measure());
    } catch {
      /* older browsers — measured positions are still fine */
    }

    // Re-measure on the next frame too, so layout shifts after mount settle.
    const frame = requestAnimationFrame(() => measure());

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [edges, variant]);

  return (
    <div
      ref={canvasRef}
      className={canvasClass}
      style={zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: 'top left' } : undefined}
    >
      <svg className="diagram-svg" aria-hidden="true">
        <defs>
          {(['main', 'yes', 'no'] as const).map((kind) => (
            <marker
              key={kind}
              id={`arrow-${kind}-${markerId}`}
              viewBox="0 0 6 6"
              refX="5"
              refY="3"
              markerWidth="4"
              markerHeight="4"
              markerUnits="strokeWidth"
              orient="auto"
            >
              <path d="M 0 0 L 6 3 L 0 6 Z" className={`arrow-body ${kind}`} />
            </marker>
          ))}
        </defs>
        {edges.map((edge) => (
          <path
            key={edge.id}
            ref={(element) => {
              if (element) pathRefs.current.set(edge.id, element);
            }}
            className={`diagram-edge ${edgeKind(edge)}`}
            markerEnd={`url(#arrow-${edgeKind(edge)}-${markerId})`}
          />
        ))}
      </svg>

      {edges
        .filter((edge) => edge.label)
        .map((edge) => (
          <span
            key={`label-${edge.id}`}
            ref={(element) => {
              if (element) labelRefs.current.set(edge.id, element);
            }}
            className={`edge-label ${edgeKind(edge)}`}
          >
            {edge.label}
          </span>
        ))}

      {nodes.map((node) => (
        <div
          key={node.id}
          ref={(element) => {
            if (element) nodeRefs.current.set(node.slot, element);
          }}
          className={`flow-node ${SLOT_CLASS[node.slot]}`}
        >
          {node.kind === 'decision' ? <span>{node.label}</span> : node.label}
        </div>
      ))}
    </div>
  );
}