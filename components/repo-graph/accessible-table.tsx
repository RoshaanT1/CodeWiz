"use client";

import type { RepositoryGraphNode } from "./graph-types";

export type AccessibleTableProps = {
  nodes: RepositoryGraphNode[];
  selectedId: string | null;
  onSelectNode: (node: RepositoryGraphNode) => void;
};

export function AccessibleTable({ nodes, selectedId, onSelectNode }: AccessibleTableProps) {
  return (
    <div className="h-full w-full overflow-y-auto bg-[#070a0f] p-4 text-xs font-mono text-zinc-300">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-100">Synchronized Node Catalog ({nodes.length} nodes)</h3>
        <span className="text-[11px] text-zinc-500">Screen-reader & keyboard accessible view</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-950">
        <table className="w-full text-left" aria-label="Repository Graph Structure">
          <thead className="border-b border-zinc-800 bg-zinc-900/60 text-[11px] text-zinc-400">
            <tr>
              <th scope="col" className="px-3 py-2.5">Name</th>
              <th scope="col" className="px-3 py-2.5">Type</th>
              <th scope="col" className="px-3 py-2.5">Path</th>
              <th scope="col" className="px-3 py-2.5 text-right">Importance</th>
              <th scope="col" className="px-3 py-2.5 text-right">Callers</th>
              <th scope="col" className="px-3 py-2.5 text-right">Callees</th>
              <th scope="col" className="px-3 py-2.5">Challenge Ready</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {nodes.map((node) => {
              const isSelected = node.id === selectedId;
              return (
                <tr
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectNode(node);
                    }
                  }}
                  className={`cursor-pointer transition-colors focus:outline-none focus:bg-cyan-950/40 ${
                    isSelected
                      ? "bg-cyan-950/30 text-cyan-200"
                      : "hover:bg-zinc-900/50 text-zinc-300"
                  }`}
                >
                  <td className="px-3 py-2 font-semibold text-zinc-100">{node.name}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                      {node.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{node.path ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold text-cyan-400">
                    {node.importanceScore !== undefined ? node.importanceScore.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-400">
                    {node.metadata?.callers !== undefined ? String(node.metadata.callers) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-400">
                    {node.metadata?.callees !== undefined ? String(node.metadata.callees) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {node.challengeEligible ? (
                      <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                        ● Ready
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
