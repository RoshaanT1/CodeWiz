"use client";

import type { GraphNodeType } from "./graph-types";

export type GraphLegendProps = {
  activeTypeFilter: GraphNodeType | "all";
  onSelectTypeFilter: (type: GraphNodeType | "all") => void;
};

const LEGEND_ITEMS: { type: GraphNodeType; label: string; color: string }[] = [
  { type: "repository", label: "Repository", color: "bg-sky-400 border-sky-300" },
  { type: "folder", label: "Folder", color: "bg-slate-500 border-slate-400" },
  { type: "file", label: "File", color: "bg-slate-400 border-slate-300" },
  { type: "function", label: "Function", color: "bg-zinc-400 border-zinc-300" },
  { type: "entry_point", label: "Entry Point", color: "bg-yellow-400 border-yellow-300" },
  { type: "service", label: "Service / Core", color: "bg-emerald-400 border-emerald-300" },
  { type: "utility", label: "Utility", color: "bg-pink-400 border-pink-300" },
  { type: "challenge_candidate", label: "Challenge Candidate", color: "bg-cyan-400 border-cyan-200 animate-pulse" },
];

export function GraphLegend({ activeTypeFilter, onSelectTypeFilter }: GraphLegendProps) {
  return (
    <div className="absolute bottom-3 left-3 z-10 max-w-sm rounded-lg border border-border/40 bg-zinc-950/85 p-3 text-xs backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        <span>Node Hierarchy</span>
        {activeTypeFilter !== "all" && (
          <button
            onClick={() => onSelectTypeFilter("all")}
            className="text-[10px] text-cyan-400 hover:underline"
          >
            Clear Filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
        {LEGEND_ITEMS.map((item) => {
          const isActive = activeTypeFilter === item.type;
          return (
            <button
              key={item.type}
              onClick={() => onSelectTypeFilter(isActive ? "all" : item.type)}
              className={`flex items-center gap-2 rounded px-1.5 py-1 text-left transition-all ${
                isActive
                  ? "bg-zinc-800 text-cyan-300 ring-1 ring-cyan-500/50"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-sm border ${item.color} shadow-sm`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 border-t border-zinc-800/80 pt-2 font-mono text-[10px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-cyan-400/80 inline-block" /> calls
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-slate-500 inline-block" /> contains
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-yellow-400/80 inline-block" /> data access
          </span>
        </div>
      </div>
    </div>
  );
}
