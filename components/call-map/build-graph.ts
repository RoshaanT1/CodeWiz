import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { CallMapFunction, CallMapCall, Category } from "./index";

/** Horizontal gap between column centres (px) */
const COL_GAP = 260;
/** Vertical gap between nodes (px) */
const ROW_GAP = 90;

/** Default colours per category (Tailwind-like HSL values) */
const DEFAULT_COLORS: Record<Category, string> = {
  entry: "hsl(220 70% 50%)",   // blue
  core: "hsl(262 60% 55%)",    // purple
  data: "hsl(158 60% 40%)",    // green
  helper: "hsl(38 80% 50%)",   // amber
};

const SELECTED_COLOR = "hsl(220 70% 50%)";

type BuildOptions = {
  functions: CallMapFunction[];
  calls: CallMapCall[];
  selectedId: string;
  maxNodes: number;
  categoryColors?: Partial<Record<Category, string>>;
};

type GraphResult = {
  nodes: Node[];
  edges: Edge[];
};

/** Build the nodes and edges arrays for React Flow. */
export function buildGraph({
  functions,
  calls,
  selectedId,
  maxNodes,
  categoryColors,
}: BuildOptions): GraphResult {
  const fnMap = new Map(functions.map((f) => [f.id, f]));
  const colors: Record<Category, string> = {
    ...DEFAULT_COLORS,
    ...categoryColors,
  };

  const selected = fnMap.get(selectedId);
  if (!selected) return { nodes: [], edges: [] };

  // Collect callers (left column) – functions that call the selected one
  const callerIds = calls
    .filter((c) => c.calleeId === selectedId && fnMap.has(c.callerId))
    .map((c) => c.callerId)
    .filter((id) => id !== selectedId)
    .slice(0, maxNodes);

  // Collect callees (right column) – functions called by the selected one
  const calleeIds = calls
    .filter((c) => c.callerId === selectedId && fnMap.has(c.calleeId))
    .map((c) => c.calleeId)
    .filter((id) => id !== selectedId)
    .slice(0, maxNodes);

  // Check for self-call
  const selfCall = calls.some(
    (c) => c.callerId === selectedId && c.calleeId === selectedId,
  );

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Helper: colour for a function
  const colorFor = (fn: CallMapFunction): string => {
    const cat = fn.category ?? "helper";
    return colors[cat] ?? DEFAULT_COLORS.helper;
  };

  // ── Selected node (centre column) ────────────────────────────────────────
  nodes.push({
    id: selectedId,
    type: "function",
    position: { x: COL_GAP, y: 0 },
    data: {
      label: selected.name,
      file: selected.file,
      category: selected.category ?? "helper",
      color: SELECTED_COLOR,
      isSelected: true,
      selfCall,
    },
  });

  // ── Caller nodes (left column) ────────────────────────────────────────────
  const callerStartY = -(((callerIds.length - 1) * ROW_GAP) / 2);
  callerIds.forEach((cid, i) => {
    const fn = fnMap.get(cid)!;
    const y = callerStartY + i * ROW_GAP;
    nodes.push({
      id: cid,
      type: "function",
      position: { x: 0, y },
      data: {
        label: fn.name,
        file: fn.file,
        category: fn.category ?? "helper",
        color: colorFor(fn),
        isSelected: false,
        selfCall: false,
      },
    });
    edges.push({
      id: `${cid}->${selectedId}`,
      source: cid,
      target: selectedId,
      type: "smoothstep",
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#888" },
      style: { stroke: "#666", strokeWidth: 1.5 },
    });
  });

  // ── Callee nodes (right column) ───────────────────────────────────────────
  const calleeStartY = -(((calleeIds.length - 1) * ROW_GAP) / 2);
  calleeIds.forEach((cid, i) => {
    const fn = fnMap.get(cid)!;
    const y = calleeStartY + i * ROW_GAP;
    nodes.push({
      id: cid,
      type: "function",
      position: { x: COL_GAP * 2, y },
      data: {
        label: fn.name,
        file: fn.file,
        category: fn.category ?? "helper",
        color: colorFor(fn),
        isSelected: false,
        selfCall: false,
      },
    });
    edges.push({
      id: `${selectedId}->${cid}`,
      source: selectedId,
      target: cid,
      type: "smoothstep",
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#888" },
      style: { stroke: "#666", strokeWidth: 1.5 },
    });
  });

  // Hidden-count labels
  const totalCallers = calls.filter(
    (c) => c.calleeId === selectedId && c.callerId !== selectedId && fnMap.has(c.callerId),
  ).length;
  const totalCallees = calls.filter(
    (c) => c.callerId === selectedId && c.calleeId !== selectedId && fnMap.has(c.calleeId),
  ).length;

  if (totalCallers > maxNodes) {
    nodes.push({
      id: "__hidden_callers",
      type: "function",
      position: { x: 0, y: callerStartY + callerIds.length * ROW_GAP },
      data: {
        label: `+${totalCallers - maxNodes} more`,
        file: undefined,
        category: "helper" as Category,
        color: "#555",
        isSelected: false,
        selfCall: false,
        isHidden: true,
      },
    });
  }
  if (totalCallees > maxNodes) {
    nodes.push({
      id: "__hidden_callees",
      type: "function",
      position: { x: COL_GAP * 2, y: calleeStartY + calleeIds.length * ROW_GAP },
      data: {
        label: `+${totalCallees - maxNodes} more`,
        file: undefined,
        category: "helper" as Category,
        color: "#555",
        isSelected: false,
        selfCall: false,
        isHidden: true,
      },
    });
  }

  return { nodes, edges };
}
