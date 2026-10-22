"use client";

import "@xyflow/react/dist/style.css";

import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
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
  /** Most callers or callees shown on each side. Default 20. */
  maxNodes?: number;
  categoryColors?: Partial<Record<Category, string>>;
  className?: string;
};

const DEFAULT_COLORS: Record<Category, string> = {
  entry: "#2563eb",
  core: "#059669",
  data: "#d97706",
  helper: "#6b7280",
};

const COLUMN = 300;
const ROW = 64;

function label(fn: CallMapFunction) {
  return (
    <div style={{ textAlign: "left", lineHeight: 1.3 }}>
      <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fn.name}</div>
      {fn.file && (
        <div style={{ fontSize: 10, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
          {fn.file}
        </div>
      )}
    </div>
  );
}

/**
 * Callers on the left, the selected function in the middle, callees on the
 * right, one step out each way. Click a node to move the view to it.
 * No data fetching: everything comes in through props.
 */
export function CallMap({ functions, calls, selectedId, onSelect, maxNodes = 20, categoryColors, className }: CallMapProps) {
  const colors = { ...DEFAULT_COLORS, ...categoryColors };

  const { nodes, edges } = useMemo(() => {
    const byId = new Map(functions.map((f) => [f.id, f]));
    const selected = byId.get(selectedId);
    if (!selected) return { nodes: [] as Node[], edges: [] as Edge[] };

    const unique = (ids: string[]) => [...new Set(ids)].filter((id) => id !== selectedId && byId.has(id));
    const callers = unique(calls.filter((c) => c.calleeId === selectedId).map((c) => c.callerId));
    const callees = unique(calls.filter((c) => c.callerId === selectedId).map((c) => c.calleeId));
    const recursive = calls.some((c) => c.callerId === selectedId && c.calleeId === selectedId);

    const style = (fn: CallMapFunction, isSelected: boolean) => {
      const color = colors[fn.category ?? "helper"];
      return {
        width: 220,
        border: `${isSelected ? 3 : 1.5}px solid ${color}`,
        borderLeft: `6px solid ${color}`,
        borderRadius: 8,
        background: "var(--card, #fff)",
        color: "var(--foreground, #111)",
        padding: "6px 10px",
        cursor: "pointer",
      };
    };

    const column = (ids: string[], x: number, side: "caller" | "callee") => {
      const shown = ids.slice(0, maxNodes);
      const top = -((shown.length - 1) * ROW) / 2;
      const out: Node[] = shown.map((id, i) => {
        const fn = byId.get(id) as CallMapFunction;
        return { id: `${side}:${id}`, position: { x, y: top + i * ROW }, data: { label: label(fn), fnId: id }, style: style(fn, false), sourcePosition: "right", targetPosition: "left" } as Node;
      });
      if (ids.length > shown.length) {
        out.push({
          id: `${side}:more`,
          position: { x, y: top + shown.length * ROW },
          data: { label: `+${ids.length - shown.length} more` },
          style: { width: 220, fontSize: 11, border: "1px dashed #9ca3af", borderRadius: 8, background: "transparent" },
          selectable: false,
        } as Node);
      }
      return out;
    };

    const nodes: Node[] = [
      ...column(callers, 0, "caller"),
      {
        id: `selected:${selectedId}`,
        position: { x: COLUMN, y: 0 },
        data: { label: label({ ...selected, name: recursive ? `${selected.name} ↻` : selected.name }), fnId: selectedId },
        style: style(selected, true),
        sourcePosition: "right",
        targetPosition: "left",
      } as Node,
      ...column(callees, COLUMN * 2, "callee"),
    ];
    const arrow = { type: MarkerType.ArrowClosed };
    const edges: Edge[] = [
      ...callers.slice(0, maxNodes).map((id) => ({ id: `e:${id}->sel`, source: `caller:${id}`, target: `selected:${selectedId}`, markerEnd: arrow })),
      ...callees.slice(0, maxNodes).map((id) => ({ id: `e:sel->${id}`, source: `selected:${selectedId}`, target: `callee:${id}`, markerEnd: arrow })),
    ];
    return { nodes, edges };
    // colors is rebuilt each render from categoryColors; depend on its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <ReactFlow
        key={selectedId}
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_event, node) => {
          const fnId = (node.data as { fnId?: string }).fnId;
          if (fnId && onSelect) onSelect(fnId);
        }}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
