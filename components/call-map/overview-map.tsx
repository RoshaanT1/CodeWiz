"use client";

import "@xyflow/react/dist/style.css";

import { Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";

import { CATEGORY_COLORS, FunctionCard, LABEL_NODE_CSS, cardStyle, type CallMapCall, type Category } from "./call-map-graph";

export type OverviewFunction = {
  id: string;
  name: string;
  file?: string;
  category?: Category;
  importance: number;
  /** Ineligible functions (tests, trivial ones) are left off the overview. */
  eligible?: boolean;
};

export type OverviewMapProps = {
  functions: OverviewFunction[];
  calls: CallMapCall[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** How many of the most important functions to show. Default 14. */
  limit?: number;
  className?: string;
};

const ORDER: Category[] = ["entry", "core", "data", "helper"];
const COLUMN_TITLES: Record<Category, string> = { entry: "Entry points", core: "Core logic", data: "Data access", helper: "Helpers" };
const COLUMN = 330;
const ROW = 80;
const HEADER_Y = -64;

/**
 * The repo at a glance: its most important functions in columns from entry
 * points to helpers, with arrows for the calls between them.
 */
export function OverviewMap({ functions, calls, selectedId, onSelect, limit = 14, className }: OverviewMapProps) {
  const { nodes, edges, shown } = useMemo(() => {
    // Start from the most important functions, then add their most important
    // callers and callees, so the overview shows how the key code connects
    // rather than a list of unrelated cards.
    const byId = new Map(functions.map((f) => [f.id, f]));
    const ranked = [...functions].filter((f) => f.eligible !== false).sort((a, b) => b.importance - a.importance);
    const seeds = ranked.slice(0, Math.max(1, Math.ceil(limit / 3)));
    const ids = new Set(seeds.map((f) => f.id));
    const byImportance = (list: string[]) =>
      [...new Set(list)].filter((id) => byId.has(id) && !ids.has(id)).sort((a, b) => (byId.get(b)?.importance ?? 0) - (byId.get(a)?.importance ?? 0));
    for (const seed of seeds) {
      const callers = byImportance(calls.filter((c) => c.calleeId === seed.id).map((c) => c.callerId)).slice(0, 2);
      const callees = byImportance(calls.filter((c) => c.callerId === seed.id).map((c) => c.calleeId)).slice(0, 2);
      for (const id of [...callers, ...callees]) if (ids.size < limit) ids.add(id);
    }
    for (const f of ranked) if (ids.size < limit) ids.add(f.id);
    const top = [...ids].map((id) => byId.get(id) as OverviewFunction).sort((a, b) => b.importance - a.importance);
    const columns = ORDER.map((cat) => top.filter((f) => (f.category ?? "helper") === cat)).filter((c) => c.length > 0);

    const nodes: Node[] = [];
    columns.forEach((col, ci) => {
      const cat = (col[0]?.category ?? "helper") as Category;
      nodes.push({
        id: `header:${cat}`,
        position: { x: ci * COLUMN, y: HEADER_Y },
        data: { label: COLUMN_TITLES[cat] },
        style: { width: 270, border: "none", background: "transparent", padding: 0, fontSize: 13, fontWeight: 700, color: CATEGORY_COLORS[cat], textAlign: "center" as const },
        selectable: false,
        className: "cw-label",
      });
      col.forEach((fn, ri) => {
        const color = CATEGORY_COLORS[fn.category ?? "helper"];
        nodes.push({
          id: fn.id,
          position: { x: ci * COLUMN, y: ri * ROW },
          data: { label: <FunctionCard fn={fn} color={color} selected={fn.id === selectedId} />, fnId: fn.id },
          style: cardStyle(color, fn.id === selectedId),
          sourcePosition: "right",
          targetPosition: "left",
        } as Node);
      });
    });

    const seen = new Set<string>();
    const edges: Edge[] = calls
      .filter((c) => ids.has(c.callerId) && ids.has(c.calleeId) && c.callerId !== c.calleeId)
      .filter((c) => {
        const key = `${c.callerId}>${c.calleeId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((c) => {
        const touchesSelected = c.callerId === selectedId || c.calleeId === selectedId;
        return {
          id: `e:${c.callerId}>${c.calleeId}`,
          source: c.callerId,
          target: c.calleeId,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          style: { stroke: touchesSelected ? "#16a37a" : "#94a3b8", strokeWidth: touchesSelected ? 2.25 : 1.25, opacity: selectedId && !touchesSelected ? 0.35 : 0.9 },
        };
      });
    return { nodes, edges, shown: top.length };
  }, [functions, calls, selectedId, limit]);

  if (shown === 0) {
    return (
      <div className={className} style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 13, opacity: 0.7 }}>
        No functions to show yet.
      </div>
    );
  }

  return (
    <div className={className} style={{ width: "100%", height: "100%" }} data-testid="overview-map">
      <style>{LABEL_NODE_CSS}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.1, minZoom: 0.3, maxZoom: 1.05 }}
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
