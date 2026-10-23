"use client";

import "@xyflow/react/dist/style.css";

import { Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";

export type Category = "entry" | "core" | "data" | "helper";

export type CallMapFunction = {
  id: string;
  name: string;
  file?: string;
  category?: Category;
};

export type CallMapCall = { callerId: string; calleeId: string };

export type CallMapProps = {
  functions: CallMapFunction[];
  calls: CallMapCall[];
  selectedId: string;
  onSelect?: (id: string) => void;
  /** Most callers or callees shown on each side. Default 8. */
  maxNodes?: number;
  categoryColors?: Partial<Record<Category, string>>;
  className?: string;
};

export const CATEGORY_COLORS: Record<Category, string> = {
  entry: "#2563eb",
  core: "#7c3aed",
  data: "#059669",
  helper: "#d97706",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  entry: "Entry point",
  core: "Core logic",
  data: "Data access",
  helper: "Helper",
};

const NODE_WIDTH = 270;
const COLUMN = 380;
const ROW = 76;
const HEADER_Y = -70;

/** A readable card: category tag, name, file. */
export function FunctionCard({ fn, color, selected }: { fn: CallMapFunction; color: string; selected?: boolean }) {
  return (
    <div style={{ textAlign: "left", lineHeight: 1.25 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color }}>
        {CATEGORY_LABELS[fn.category ?? "helper"]}
      </div>
      <div style={{ fontSize: selected ? 16 : 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={fn.name}>
        {fn.name}
      </div>
      {fn.file && (
        <div style={{ fontSize: 11, opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }} title={fn.file}>
          {fn.file}
        </div>
      )}
    </div>
  );
}

export function cardStyle(color: string, selected: boolean) {
  return {
    width: NODE_WIDTH,
    border: `${selected ? 2.5 : 1}px solid ${selected ? color : "rgba(100,116,139,0.35)"}`,
    borderLeft: `6px solid ${color}`,
    borderRadius: 10,
    background: "hsl(var(--card, 0 0% 100%))",
    color: "hsl(var(--foreground, 222 47% 11%))",
    padding: "8px 12px",
    cursor: "pointer",
    boxShadow: selected ? `0 0 0 4px ${color}22` : "none",
  };
}

/** Header and note nodes are labels, not functions: hide their connection dots. */
export const LABEL_NODE_CSS = ".react-flow__node.cw-label .react-flow__handle { display: none; }";

const headerStyle = { width: NODE_WIDTH, border: "none", background: "transparent", padding: 0, fontSize: 13, fontWeight: 700, color: "hsl(var(--muted-foreground, 215 16% 47%))", textAlign: "center" as const };
const noteStyle = { width: NODE_WIDTH, border: "1px dashed rgba(100,116,139,0.45)", borderRadius: 10, background: "transparent", padding: "10px 12px", fontSize: 12, lineHeight: 1.35, color: "hsl(var(--muted-foreground, 215 16% 47%))" };

/**
 * One function and its neighbours: who calls it on the left, what it calls on
 * the right, each column labelled. Click a card to move the map to it.
 * No data fetching: everything comes in through props.
 */
export function CallMap({ functions, calls, selectedId, onSelect, maxNodes = 8, categoryColors, className }: CallMapProps) {
  const { nodes, edges } = useMemo(() => {
    const colors = { ...CATEGORY_COLORS, ...categoryColors };
    const byId = new Map(functions.map((f) => [f.id, f]));
    const selected = byId.get(selectedId);
    if (!selected) return { nodes: [] as Node[], edges: [] as Edge[] };

    const unique = (ids: string[]) => [...new Set(ids)].filter((id) => id !== selectedId && byId.has(id));
    const callers = unique(calls.filter((c) => c.calleeId === selectedId).map((c) => c.callerId));
    const callees = unique(calls.filter((c) => c.callerId === selectedId).map((c) => c.calleeId));
    const color = (fn: CallMapFunction) => colors[fn.category ?? "helper"];

    const column = (ids: string[], x: number, side: "caller" | "callee"): Node[] => {
      const shown = ids.slice(0, maxNodes);
      const out: Node[] = [
        {
          id: `${side}:header`,
          position: { x, y: HEADER_Y },
          data: { label: side === "caller" ? `Called by (${ids.length})` : `Calls (${ids.length})` },
          style: headerStyle,
          selectable: false,
          draggable: false,
          className: "cw-label",
        },
      ];
      if (shown.length === 0) {
        out.push({
          id: `${side}:empty`,
          position: { x, y: 0 },
          data: {
            label:
              side === "caller"
                ? "Nothing in this repo calls it. It's likely an entry point: a route, a command or an export."
                : "It doesn't call any other function in this repo.",
          },
          style: noteStyle,
          selectable: false,
          className: "cw-label",
        });
      }
      shown.forEach((id, i) => {
        const fn = byId.get(id) as CallMapFunction;
        out.push({
          id: `${side}:${id}`,
          position: { x, y: i * ROW },
          data: { label: <FunctionCard fn={fn} color={color(fn)} />, fnId: id },
          style: cardStyle(color(fn), false),
          sourcePosition: "right",
          targetPosition: "left",
        } as Node);
      });
      if (ids.length > shown.length) {
        out.push({
          id: `${side}:more`,
          position: { x, y: shown.length * ROW },
          data: { label: `+${ids.length - shown.length} more` },
          style: { ...noteStyle, textAlign: "center" as const },
          selectable: false,
          className: "cw-label",
        });
      }
      return out;
    };

    const middleY = Math.max(0, ((Math.min(Math.max(callers.length, callees.length), maxNodes) - 1) * ROW) / 2);
    const recursive = calls.some((c) => c.callerId === selectedId && c.calleeId === selectedId);
    const nodes: Node[] = [
      ...column(callers, 0, "caller"),
      { id: "selected:header", position: { x: COLUMN, y: HEADER_Y }, data: { label: "Selected function" }, style: headerStyle, selectable: false, className: "cw-label" },
      {
        id: `selected:${selectedId}`,
        position: { x: COLUMN, y: middleY },
        data: { label: <FunctionCard fn={{ ...selected, name: recursive ? `${selected.name} ↻` : selected.name }} color={color(selected)} selected />, fnId: selectedId },
        style: cardStyle(color(selected), true),
        sourcePosition: "right",
        targetPosition: "left",
      } as Node,
      ...column(callees, COLUMN * 2, "callee"),
    ];
    const arrow = { type: MarkerType.ArrowClosed, width: 18, height: 18 };
    const edgeStyle = { stroke: "#94a3b8", strokeWidth: 1.5 };
    const edges: Edge[] = [
      ...callers.slice(0, maxNodes).map((id) => ({ id: `e:${id}->sel`, source: `caller:${id}`, target: `selected:${selectedId}`, markerEnd: arrow, style: edgeStyle })),
      ...callees.slice(0, maxNodes).map((id) => ({ id: `e:sel->${id}`, source: `selected:${selectedId}`, target: `callee:${id}`, markerEnd: arrow, style: edgeStyle })),
    ];
    return { nodes, edges };
  }, [functions, calls, selectedId, maxNodes, categoryColors]);

  if (nodes.length === 0) {
    return (
      <div className={className} style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 13, opacity: 0.7 }}>
        Select a function to see its callers and callees.
      </div>
    );
  }

  return (
    <div className={className} style={{ width: "100%", height: "100%" }} data-testid="call-map">
      <style>{LABEL_NODE_CSS}</style>
      <ReactFlow
        key={selectedId}
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.12, minZoom: 0.3, maxZoom: 1.1 }}
        minZoom={0.25}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        onNodeClick={(_event, node) => {
          const fnId = (node.data as { fnId?: string }).fnId;
          if (fnId && onSelect) onSelect(fnId);
        }}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
