"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type {
  RepositoryGraph,
  RepositoryGraphNode,
  GraphNodeType,
  AnalysisStatus,
} from "./graph-types";
import { GraphCanvas } from "./graph-canvas";
import { GitGraphView } from "./git-graph-view";
import { GraphToolbar } from "./graph-toolbar";
import { GraphLegend } from "./graph-legend";
import { NodeInspector } from "./node-inspector";
import { AccessibleTable } from "./accessible-table";
import { KeyboardShortcutsModal } from "./keyboard-shortcuts-modal";
import { AnalysisProgress } from "./analysis-progress";

export type RepoGraphWorkspaceProps = {
  graph: RepositoryGraph;
  status: AnalysisStatus;
  repoUrl?: string;
  missingDataReason?: string;
  onRefreshAnalysis?: () => void;
  onStartRoundWithFunction?: (fnId: string) => void;
  onFocusNode?: (nodeId: string) => void;
};

export function RepoGraphWorkspace({
  graph,
  status,
  repoUrl,
  missingDataReason,
  onRefreshAnalysis,
  onStartRoundWithFunction,
  onFocusNode,
}: RepoGraphWorkspaceProps) {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<GraphNodeType | "all">("all");
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [is3dCube, setIs3dCube] = useState(false);
  const [animate, setAnimate] = useState(true);
  const [viewMode, setViewMode] = useState<"git-graph" | "canvas" | "table">("git-graph");
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Filter nodes based on search and type filter
  const filteredNodes = useMemo(() => {
    return graph.nodes.filter((node) => {
      const matchesSearch =
        search.trim() === "" ||
        node.name.toLowerCase().includes(search.toLowerCase()) ||
        (node.path && node.path.toLowerCase().includes(search.toLowerCase()));

      const matchesType = typeFilter === "all" || node.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [graph.nodes, search, typeFilter]);

  // Selected node object
  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return graph.nodes.find((n) => n.id === selectedId) ?? null;
  }, [graph.nodes, selectedId]);

  // Toolbar actions
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z * 1.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, z / 1.25));
  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleSelectNode = useCallback(
    (node: RepositoryGraphNode | null) => {
      setSelectedId(node?.id ?? null);
      if (node && onFocusNode) {
        onFocusNode(node.id);
      }
    },
    [onFocusNode]
  );

  const handleFocusNode = useCallback(
    (node: RepositoryGraphNode) => {
      if (node.x !== undefined && node.y !== undefined) {
        setPan({ x: -node.x * zoom, y: -node.y * zoom });
      }
      if (onFocusNode) {
        onFocusNode(node.id);
      }
    },
    [zoom, onFocusNode]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        handleResetView();
      } else if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        setShowGrid((v) => !v);
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        setShowLabels((v) => !v);
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setIs3dCube((v) => !v);
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        setAnimate((v) => !v);
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setViewMode((m) => (m === "git-graph" ? "table" : m === "table" ? "canvas" : "git-graph"));
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setShowShortcuts(false);
      } else if (e.key === "?") {
        setShowShortcuts(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col rounded-xl border border-border/50 bg-[#05070a] shadow-2xl overflow-hidden min-h-[560px]">
      {/* Top Toolbar */}
      <GraphToolbar
        search={search}
        onSearchChange={setSearch}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        is3dCube={is3dCube}
        onToggle3dCube={() => setIs3dCube((v) => !v)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        animate={animate}
        onToggleAnimate={() => setAnimate((v) => !v)}
        viewMode={viewMode}
        onChangeViewMode={(mode) => setViewMode(mode)}
        nodeCount={filteredNodes.length}
        edgeCount={graph.edges.length}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />

      {/* Main Workspace Body */}
      <div className="relative flex-1 min-h-[480px]">
        {/* Partial result banner */}
        {graph.isPartial && status === "ready" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shadow-lg backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>
              {missingDataReason || "Partial graph: some call relationships or files are still being parsed."}
            </span>
            {onRefreshAnalysis && (
              <button
                type="button"
                onClick={onRefreshAnalysis}
                className="underline font-medium hover:text-white transition-colors"
              >
                Re-index
              </button>
            )}
          </div>
        )}

        {/* Loading overlay during in-flight analysis */}
        {status !== "ready" && status !== "partial" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <AnalysisProgress status={status} repoUrl={repoUrl} />
          </div>
        )}

        {/* View mode render */}
        {viewMode === "git-graph" ? (
          <>
            <GitGraphView
              nodes={filteredNodes}
              edges={graph.edges}
              selectedId={selectedId}
              onSelectNode={handleSelectNode}
              onStartRoundWithFunction={onStartRoundWithFunction}
              searchQuery={search}
            />

            {/* Interactive Hierarchy Legend */}
            <GraphLegend
              activeTypeFilter={typeFilter}
              onSelectTypeFilter={setTypeFilter}
            />

            {/* Node Detail Inspector Panel */}
            <NodeInspector
              node={selectedNode}
              onClose={() => setSelectedId(null)}
              onFocusNode={handleFocusNode}
              onStartRoundWithFunction={onStartRoundWithFunction}
            />
          </>
        ) : viewMode === "canvas" ? (
          <>
            <GraphCanvas
              nodes={filteredNodes}
              edges={graph.edges}
              selectedId={selectedId}
              onSelectNode={handleSelectNode}
              hoveredId={hoveredId}
              onHoverNode={(node) => setHoveredId(node?.id ?? null)}
              zoom={zoom}
              pan={pan}
              onPanChange={setPan}
              showGrid={showGrid}
              showLabels={showLabels}
              is3dCube={is3dCube}
              animate={animate}
            />

            <GraphLegend
              activeTypeFilter={typeFilter}
              onSelectTypeFilter={setTypeFilter}
            />

            <NodeInspector
              node={selectedNode}
              onClose={() => setSelectedId(null)}
              onFocusNode={handleFocusNode}
              onStartRoundWithFunction={onStartRoundWithFunction}
            />
          </>
        ) : (
          <AccessibleTable
            nodes={filteredNodes}
            selectedId={selectedId}
            onSelectNode={(node) => setSelectedId(node.id)}
          />
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
