"use client";

import { useState } from "react";
import type { RepositoryGraphNode } from "./graph-types";
import { Button } from "@/components/ui/button";

export type NodeInspectorProps = {
  node: RepositoryGraphNode | null;
  onClose: () => void;
  onFocusNode: (node: RepositoryGraphNode) => void;
  onStartRoundWithFunction?: (fnId: string) => void;
};

export function NodeInspector({
  node,
  onClose,
  onFocusNode,
  onStartRoundWithFunction,
}: NodeInspectorProps) {
  const [copied, setCopied] = useState(false);

  if (!node) return null;

  const handleCopyPath = () => {
    if (node.path) {
      navigator.clipboard.writeText(node.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isFunction = [
    "function",
    "entry_point",
    "service",
    "utility",
    "challenge_candidate",
  ].includes(node.type);

  return (
    <div className="absolute right-3 top-14 z-20 w-80 rounded-xl border border-border/50 bg-[#090d14]/95 p-4 text-xs shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                node.type === "challenge_candidate"
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                  : node.type === "entry_point"
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                  : node.type === "service"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-300"
              }`}
            >
              {node.type.replace("_", " ")}
            </span>
            {node.language && (
              <span className="font-mono text-[10px] text-zinc-500">
                {node.language}
              </span>
            )}
          </div>
          <h3 className="font-mono text-sm font-bold text-zinc-100 break-all">
            {node.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          ✕
        </button>
      </div>

      {/* Body details */}
      <div className="space-y-3 py-3 font-mono text-zinc-300">
        {node.path && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase text-zinc-500">Location</span>
            <div className="flex items-center justify-between gap-1 rounded bg-zinc-950/80 p-2 text-[11px] text-zinc-300">
              <span className="truncate">{node.path}</span>
              <button
                onClick={handleCopyPath}
                className="shrink-0 text-[10px] text-cyan-400 hover:underline"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {node.importanceScore !== undefined && (
            <div className="rounded bg-zinc-900/40 p-2 border border-zinc-800/60">
              <span className="text-[10px] uppercase text-zinc-500">Importance</span>
              <p className="text-sm font-bold text-cyan-400">
                {node.importanceScore.toFixed(2)}
              </p>
            </div>
          )}

          {node.complexityScore !== undefined && (
            <div className="rounded bg-zinc-900/40 p-2 border border-zinc-800/60">
              <span className="text-[10px] uppercase text-zinc-500">Branches</span>
              <p className="text-sm font-bold text-zinc-200">
                {node.complexityScore}
              </p>
            </div>
          )}

          {node.metadata?.callers !== undefined && (
            <div className="rounded bg-zinc-900/40 p-2 border border-zinc-800/60">
              <span className="text-[10px] uppercase text-zinc-500">Callers</span>
              <p className="text-sm font-bold text-zinc-200">
                {String(node.metadata.callers)}
              </p>
            </div>
          )}

          {node.metadata?.callees !== undefined && (
            <div className="rounded bg-zinc-900/40 p-2 border border-zinc-800/60">
              <span className="text-[10px] uppercase text-zinc-500">Callees</span>
              <p className="text-sm font-bold text-zinc-200">
                {String(node.metadata.callees)}
              </p>
            </div>
          )}
        </div>

        {node.confidence !== undefined && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
            <span>Analysis Confidence:</span>
            <span className="font-semibold text-emerald-400">
              {Math.round(node.confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="space-y-2 border-t border-zinc-800/80 pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFocusNode(node)}
          className="w-full h-8 border-zinc-800 bg-zinc-900/70 font-mono text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          ⌖ Center in View
        </Button>

        {isFunction && node.challengeEligible && onStartRoundWithFunction && (
          <Button
            size="sm"
            onClick={() => onStartRoundWithFunction(node.id)}
            className="w-full h-8 bg-cyan-500 hover:bg-cyan-400 font-mono text-xs font-semibold text-zinc-950 shadow-md shadow-cyan-500/20"
          >
            ⚡ Practice with this Function
          </Button>
        )}
      </div>
    </div>
  );
}
