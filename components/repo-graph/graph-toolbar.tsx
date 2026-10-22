"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type GraphToolbarProps = {
  search: string;
  onSearchChange: (val: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  is3dCube: boolean;
  onToggle3dCube: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  animate: boolean;
  onToggleAnimate: () => void;
  viewMode: "git-graph" | "canvas" | "table";
  onChangeViewMode: (mode: "git-graph" | "canvas" | "table") => void;
  nodeCount: number;
  edgeCount: number;
  onOpenShortcuts: () => void;
};

export function GraphToolbar({
  search,
  onSearchChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  is3dCube,
  onToggle3dCube,
  showGrid,
  onToggleGrid,
  showLabels,
  onToggleLabels,
  animate,
  onToggleAnimate,
  viewMode,
  onChangeViewMode,
  nodeCount,
  edgeCount,
  onOpenShortcuts,
}: GraphToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-[#070a0f]/90 px-4 py-2.5 backdrop-blur-md">
      {/* Left: Search & View Mode Switcher */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Input
            placeholder="Search nodes, functions, files..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 w-56 bg-zinc-950/80 font-mono text-xs border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-cyan-500/50"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              ×
            </button>
          )}
        </div>

        {/* View Mode Buttons */}
        <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950/80 p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => onChangeViewMode("git-graph")}
            className={`px-2.5 py-1 rounded-md transition-all font-semibold ${
              viewMode === "git-graph"
                ? "bg-[#0090ff] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Git Railway Graph (Recommended)"
          >
            ⑂ Git Graph
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("table")}
            className={`px-2 py-1 rounded-md transition-all ${
              viewMode === "table"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Accessible Table View"
          >
            ▦ Table
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("canvas")}
            className={`px-2 py-1 rounded-md transition-all ${
              viewMode === "canvas"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="2D/3D Canvas View"
          >
            ☵ Canvas
          </button>
        </div>
      </div>

      {/* Center: Graph Stats Badge */}
      <div className="hidden font-mono text-xs text-zinc-400 sm:flex items-center gap-2">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-zinc-200">{nodeCount}</span> nodes
        </span>
        <span className="text-zinc-600">/</span>
        <span>
          <span className="text-zinc-200">{edgeCount}</span> edges
        </span>
      </div>

      {/* Right: Controls & Toggles */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          title="Zoom in (+)"
          className="h-8 w-8 p-0 font-mono text-xs text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800/80"
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          title="Zoom out (-)"
          className="h-8 w-8 p-0 font-mono text-xs text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800/80"
        >
          −
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetView}
          title="Reset View"
          className="h-8 px-2 font-mono text-xs text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800/80"
        >
          Reset
        </Button>

        <div className="mx-1 h-4 w-[1px] bg-zinc-800" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle3dCube}
          title="Toggle 3D Cubes vs Flat Nodes"
          className={`h-8 px-2 font-mono text-xs ${
            is3dCube ? "bg-cyan-950/60 text-cyan-400 border border-cyan-800/40" : "text-zinc-400"
          }`}
        >
          3D Cube
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleGrid}
          title="Toggle Dark Grid Lines"
          className={`h-8 px-2 font-mono text-xs ${
            showGrid ? "text-cyan-400" : "text-zinc-500"
          }`}
        >
          Grid
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleLabels}
          title="Toggle Labels"
          className={`h-8 px-2 font-mono text-xs ${
            showLabels ? "text-cyan-400" : "text-zinc-500"
          }`}
        >
          Labels
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleAnimate}
          title="Toggle Animations"
          className={`h-8 px-2 font-mono text-xs ${
            animate ? "text-emerald-400" : "text-zinc-500"
          }`}
        >
          Motion
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts (?)"
          className="h-8 w-8 p-0 font-mono text-xs text-zinc-400 hover:text-zinc-100"
        >
          ⌨
        </Button>
      </div>
    </div>
  );
}
