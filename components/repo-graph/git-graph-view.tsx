"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import type { RepositoryGraphNode, RepositoryGraphEdge, GraphNodeType } from "./graph-types";

export interface GitGraphViewProps {
  nodes: RepositoryGraphNode[];
  edges: RepositoryGraphEdge[];
  selectedId: string | null;
  onSelectNode: (node: RepositoryGraphNode | null) => void;
  onStartRoundWithFunction?: (fnId: string) => void;
  searchQuery?: string;
}

// 5 Iconic Git Graph Railway Colors matching the reference screenshot
export const GIT_LANE_COLORS = [
  { name: "main", stroke: "#0090ff", fill: "#0090ff", bg: "bg-[#0090ff]", border: "border-[#0090ff]", text: "text-[#0090ff]" },    // Lane 0: Blue
  { name: "feature", stroke: "#e91e63", fill: "#e91e63", bg: "bg-[#e91e63]", border: "border-[#e91e63]", text: "text-[#e91e63]" }, // Lane 1: Magenta / Pink
  { name: "core", stroke: "#00c853", fill: "#00c853", bg: "bg-[#00c853]", border: "border-[#00c853]", text: "text-[#00c853]" },    // Lane 2: Bright Green
  { name: "data", stroke: "#ff9800", fill: "#ff9800", bg: "bg-[#ff9800]", border: "border-[#ff9800]", text: "text-[#ff9800]" },    // Lane 3: Vibrant Orange
  { name: "util", stroke: "#9c27b0", fill: "#9c27b0", bg: "bg-[#9c27b0]", border: "border-[#9c27b0]", text: "text-[#9c27b0]" },    // Lane 4: Vibrant Purple
  { name: "cyan", stroke: "#00bcd4", fill: "#00bcd4", bg: "bg-[#00bcd4]", border: "border-[#00bcd4]", text: "text-[#00bcd4]" },    // Lane 5: Cyan
];

const ROW_HEIGHT = 46;
const LANE_WIDTH = 24;
const LANE_START_X = 22;

// Built-in lightweight SVG Icons
function GitBranchIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function PlayIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function SparklesIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function EyeIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export type GitGraphRowData = {
  node: RepositoryGraphNode;
  row: number;
  lane: number;
  color: typeof GIT_LANE_COLORS[0];
  codeLetter: string;
};

export type GitBranchCurve = {
  id: string;
  d: string;
  stroke: string;
  strokeWidth: number;
};

export function GitGraphView({
  nodes,
  edges,
  selectedId,
  onSelectNode,
  onStartRoundWithFunction,
}: GitGraphViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Organize nodes into topological railway order
  const { rows, curves, maxLane, laneTracks } = useMemo(() => {
    const typePriority: Record<GraphNodeType, number> = {
      repository: 0,
      folder: 1,
      file: 2,
      entry_point: 3,
      service: 4,
      challenge_candidate: 5,
      function: 6,
      utility: 7,
      dependency: 8,
    };

    // Sort nodes logically
    const sortedNodes = [...nodes].sort((a, b) => {
      const prioA = typePriority[a.type] ?? 9;
      const prioB = typePriority[b.type] ?? 9;
      if (prioA !== prioB) return prioA - prioB;
      return (b.importanceScore ?? 0) - (a.importanceScore ?? 0);
    });

    const nodeRowMap = new Map<string, number>();
    const nodeLaneMap = new Map<string, number>();

    // Letter codes sequence matching git commit graph: M, L, K, J, I, H, G, F, E, D, C, B, A ...
    const letterAlphabet = ["M", "L", "K", "J", "I", "H", "G", "F", "E", "D", "C", "B", "A"];

    // File to lane mapping
    const fileLaneMap = new Map<string, number>();
    let usedLanes = 1;

    const rows: GitGraphRowData[] = sortedNodes.map((node, index) => {
      nodeRowMap.set(node.id, index);

      let lane = 0;
      if (node.type === "repository") {
        lane = 0; // Blue main trunk
      } else if (node.type === "folder") {
        lane = 0;
      } else if (node.type === "entry_point") {
        lane = 1; // Pink
      } else if (node.type === "service") {
        lane = 2; // Green
      } else if (node.type === "challenge_candidate") {
        lane = 3; // Orange
      } else if (node.type === "utility") {
        lane = 4; // Purple
      } else if (node.type === "file") {
        const filePath = node.path || node.name;
        if (!fileLaneMap.has(filePath)) {
          fileLaneMap.set(filePath, (fileLaneMap.size % 4) + 1);
        }
        lane = fileLaneMap.get(filePath)!;
      } else {
        // Function fallback
        lane = (index % 4) + 1;
      }

      nodeLaneMap.set(node.id, lane);
      if (lane >= usedLanes) usedLanes = lane + 1;

      const color = GIT_LANE_COLORS[lane % GIT_LANE_COLORS.length];
      const codeLetter =
        index < letterAlphabet.length
          ? letterAlphabet[index]
          : String.fromCharCode(65 + ((index - letterAlphabet.length) % 26));

      return {
        node,
        row: index,
        lane,
        color,
        codeLetter,
      };
    });

    const numLanes = Math.max(usedLanes, 5);

    // Track start and end rows for each lane
    const laneBounds = new Map<number, { minRow: number; maxRow: number }>();
    rows.forEach((r) => {
      const b = laneBounds.get(r.lane) || { minRow: r.row, maxRow: r.row };
      b.minRow = Math.min(b.minRow, r.row);
      b.maxRow = Math.max(b.maxRow, r.row);
      laneBounds.set(r.lane, b);
    });

    // 2. Generate SVG Track Lines (vertical lines for each active lane)
    const laneTracks: { lane: number; x: number; y1: number; y2: number; color: string }[] = [];
    laneBounds.forEach((bounds, lane) => {
      const x = LANE_START_X + lane * LANE_WIDTH;
      const y1 = bounds.minRow * ROW_HEIGHT + ROW_HEIGHT / 2;
      const y2 = bounds.maxRow * ROW_HEIGHT + ROW_HEIGHT / 2;
      laneTracks.push({
        lane,
        x,
        y1,
        y2,
        color: GIT_LANE_COLORS[lane % GIT_LANE_COLORS.length].stroke,
      });
    });

    // Ensure Lane 0 (main trunk) extends full height
    const mainBound = laneBounds.get(0);
    if (mainBound && rows.length > 0) {
      const x0 = LANE_START_X;
      const yStart = 0 * ROW_HEIGHT + ROW_HEIGHT / 2;
      const yEnd = (rows.length - 1) * ROW_HEIGHT + ROW_HEIGHT / 2;
      const idx = laneTracks.findIndex((t) => t.lane === 0);
      if (idx >= 0) {
        laneTracks[idx].y1 = yStart;
        laneTracks[idx].y2 = yEnd;
      } else {
        laneTracks.push({
          lane: 0,
          x: x0,
          y1: yStart,
          y2: yEnd,
          color: GIT_LANE_COLORS[0].stroke,
        });
      }
    }

    // 3. Generate Smooth Cubic Bezier Curves (Branching & Merging)
    const curves: GitBranchCurve[] = [];

    // A) Curves between edges in the graph
    edges.forEach((edge, idx) => {
      const fromRow = nodeRowMap.get(edge.source);
      const toRow = nodeRowMap.get(edge.target);
      if (fromRow !== undefined && toRow !== undefined && fromRow !== toRow) {
        const fromLane = nodeLaneMap.get(edge.source) ?? 0;
        const toLane = nodeLaneMap.get(edge.target) ?? 0;

        if (fromLane !== toLane) {
          const r1 = Math.min(fromRow, toRow);
          const r2 = Math.max(fromRow, toRow);
          const l1 = fromRow < toRow ? fromLane : toLane;
          const l2 = fromRow < toRow ? toLane : fromLane;

          const x1 = LANE_START_X + l1 * LANE_WIDTH;
          const y1 = r1 * ROW_HEIGHT + ROW_HEIGHT / 2;
          const x2 = LANE_START_X + l2 * LANE_WIDTH;
          const y2 = r2 * ROW_HEIGHT + ROW_HEIGHT / 2;

          // Smooth cubic S-curve
          const dy = y2 - y1;
          const cy1 = y1 + dy * 0.45;
          const cy2 = y2 - dy * 0.45;
          const path = `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;

          curves.push({
            id: `edge-${idx}`,
            d: path,
            stroke: GIT_LANE_COLORS[Math.max(l1, l2) % GIT_LANE_COLORS.length].stroke,
            strokeWidth: 3,
          });
        }
      }
    });

    // B) Ensure every branch lane has a smooth curve branching out from trunk or parent
    laneBounds.forEach((bounds, lane) => {
      if (lane > 0) {
        // Curve branching out from Lane 0 (or lane - 1) at bounds.minRow - 1 or minRow
        const parentLane = Math.max(0, lane - 1);
        const parentRow = Math.max(0, bounds.minRow - 1);

        const x1 = LANE_START_X + parentLane * LANE_WIDTH;
        const y1 = parentRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const x2 = LANE_START_X + lane * LANE_WIDTH;
        const y2 = bounds.minRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        const dy = y2 - y1;
        const cy1 = y1 + dy * 0.5;
        const cy2 = y2 - dy * 0.5;
        const branchD = `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;

        curves.push({
          id: `branch-out-${lane}`,
          d: branchD,
          stroke: GIT_LANE_COLORS[lane % GIT_LANE_COLORS.length].stroke,
          strokeWidth: 3,
        });

        // Merge curve back into Lane 0 near bottom (like in reference screenshot)
        if (bounds.maxRow < rows.length - 1) {
          const mergeTargetRow = Math.min(rows.length - 1, bounds.maxRow + 1);
          const mx1 = LANE_START_X + lane * LANE_WIDTH;
          const my1 = bounds.maxRow * ROW_HEIGHT + ROW_HEIGHT / 2;
          const mx2 = LANE_START_X + 0 * LANE_WIDTH;
          const my2 = mergeTargetRow * ROW_HEIGHT + ROW_HEIGHT / 2;

          const mdy = my2 - my1;
          const mcy1 = my1 + mdy * 0.5;
          const mcy2 = my2 - mdy * 0.5;
          const mergeD = `M ${mx1} ${my1} C ${mx1} ${mcy1}, ${mx2} ${mcy2}, ${mx2} ${my2}`;

          curves.push({
            id: `merge-back-${lane}`,
            d: mergeD,
            stroke: GIT_LANE_COLORS[lane % GIT_LANE_COLORS.length].stroke,
            strokeWidth: 3,
          });
        }
      }
    });

    return {
      rows,
      curves,
      maxLane: numLanes,
      laneTracks,
    };
  }, [nodes, edges]);

  const railsWidth = (maxLane + 1) * LANE_WIDTH + 24;
  const totalHeight = Math.max(rows.length * ROW_HEIGHT + 30, 420);

  const handleRowClick = useCallback(
    (node: RepositoryGraphNode) => {
      onSelectNode(node.id === selectedId ? null : node);
    },
    [selectedId, onSelectNode]
  );

  return (
    <div
      ref={containerRef}
      className="relative flex overflow-x-auto overflow-y-auto max-h-[640px] rounded-b-xl bg-[#0e1217] select-none border-t border-border/40 font-sans"
    >
      {/* Left Column: Authentic Git Railway SVG Tracks */}
      <div
        className="sticky left-0 top-0 z-10 shrink-0 bg-[#0e1217]"
        style={{ width: railsWidth, height: totalHeight }}
      >
        <svg
          width={railsWidth}
          height={totalHeight}
          className="overflow-visible"
          style={{ display: "block" }}
        >
          {/* 1. Continuous Vertical Tracks */}
          {laneTracks.map((track) => (
            <line
              key={`track-${track.lane}`}
              x1={track.x}
              y1={track.y1}
              x2={track.x}
              y2={track.y2}
              stroke={track.color}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}

          {/* 2. Smooth S-Curves (Branching & Merging) */}
          {curves.map((c) => (
            <path
              key={c.id}
              d={c.d}
              fill="none"
              stroke={c.stroke}
              strokeWidth={c.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* 3. Circular Node Dots */}
          {rows.map((item) => {
            const cx = LANE_START_X + item.lane * LANE_WIDTH;
            const cy = item.row * ROW_HEIGHT + ROW_HEIGHT / 2;
            const isSelected = selectedId === item.node.id;
            const isHovered = hoveredId === item.node.id;
            const isRoot = item.row === 0;

            return (
              <g
                key={`dot-${item.node.id}`}
                className="cursor-pointer"
                onClick={() => handleRowClick(item.node)}
                onMouseEnter={() => setHoveredId(item.node.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Highlight Glow when selected or hovered */}
                {(isSelected || isHovered) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={12}
                    fill={item.color.fill}
                    fillOpacity={0.25}
                    className="animate-pulse"
                  />
                )}

                {/* Main Dot */}
                {isRoot ? (
                  // Hollow Ring for Root / HEAD (matching top M in screenshot)
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6.5}
                    fill="#0e1217"
                    stroke={item.color.stroke}
                    strokeWidth={3}
                  />
                ) : (
                  // Solid Dot with clean outline
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected || isHovered ? 6.5 : 5.5}
                    fill={item.color.fill}
                    stroke="#0e1217"
                    strokeWidth={2}
                  />
                )}

                {/* Inner white pupil if selected */}
                {isSelected && (
                  <circle cx={cx} cy={cy} r={2} fill="#ffffff" />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right Column: Git Commit/Branch Badges & Metadata Rows */}
      <div className="flex-1 py-1 pr-4 min-w-[500px]" style={{ height: totalHeight }}>
        {rows.map((item) => {
          const isSelected = selectedId === item.node.id;
          const isHovered = hoveredId === item.node.id;
          const isCandidate = item.node.type === "challenge_candidate";

          return (
            <div
              key={item.node.id}
              onClick={() => handleRowClick(item.node)}
              onMouseEnter={() => setHoveredId(item.node.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ height: ROW_HEIGHT }}
              className={`group flex items-center justify-between px-3 rounded-md cursor-pointer transition-colors ${
                isSelected
                  ? "bg-[#1f242c] border border-sky-500/50 shadow-md"
                  : isHovered
                  ? "bg-[#161b22] border border-zinc-700/40"
                  : "hover:bg-[#161b22]/60 border border-transparent"
              }`}
            >
              {/* Row Left: Dual-Segment Pill Badge [ ⑂ | Letter ] + Letter + Title */}
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Reference Pill Badge matching screenshot: [ ⑂ | M ] */}
                <div className="flex items-center shrink-0 rounded-md overflow-hidden border border-zinc-700/80 bg-[#161b22] text-xs font-mono font-medium shadow-sm">
                  {/* Left segment: Solid lane color with white branch icon */}
                  <div
                    className="flex items-center justify-center px-1.5 py-1 text-white font-bold"
                    style={{ backgroundColor: item.color.fill }}
                  >
                    <GitBranchIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  {/* Right segment: Dark background with letter code */}
                  <div className="px-2 py-1 text-zinc-100 font-bold bg-[#161b22]">
                    {item.codeLetter}
                  </div>
                </div>

                {/* Secondary letter label matching reference (e.g. M, L, K, J...) */}
                <span className="font-mono text-sm font-semibold text-zinc-400 shrink-0">
                  {item.codeLetter}
                </span>

                {/* Node Name & Type Badge */}
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`font-mono text-sm font-semibold truncate ${
                      isSelected ? "text-white" : "text-zinc-200 group-hover:text-white"
                    }`}
                  >
                    {item.node.name}
                  </span>

                  {item.node.type === "challenge_candidate" && (
                    <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <SparklesIcon className="w-3 h-3 text-amber-400" />
                      Candidate
                    </span>
                  )}

                  {item.node.type === "entry_point" && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Entry
                    </span>
                  )}

                  {item.node.type === "service" && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Core
                    </span>
                  )}

                  {item.node.path && (
                    <span className="hidden sm:inline font-mono text-xs text-zinc-500 truncate max-w-xs">
                      {item.node.path}
                    </span>
                  )}
                </div>
              </div>

              {/* Row Right: Metrics & Practice CTA */}
              <div className="flex items-center gap-3 shrink-0">
                {item.node.importanceScore !== undefined && item.node.importanceScore > 0 && (
                  <span className="hidden md:inline font-mono text-xs text-zinc-400">
                    ⭐ {(item.node.importanceScore * 100).toFixed(0)}%
                  </span>
                )}

                {item.node.metadata?.callers !== undefined && (
                  <span className="hidden lg:inline font-mono text-xs text-zinc-500">
                    {String(item.node.metadata.callers)} callers
                  </span>
                )}

                {isCandidate && onStartRoundWithFunction ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartRoundWithFunction(item.node.id);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition-all hover:scale-105"
                  >
                    <PlayIcon className="w-3 h-3 fill-white" />
                    Practice
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(item.node);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition-opacity"
                    title="Inspect Node Details"
                  >
                    <EyeIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
