"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Category } from "./index";

export type FunctionNodeData = {
  label: string;
  file?: string;
  category: Category;
  color: string;
  isSelected: boolean;
  selfCall: boolean;
  isHidden?: boolean;
};

/**
 * Custom React Flow node for a function.
 * Shows the function name, file path, category badge, and handles.
 */
export const FunctionNode = memo(function FunctionNode({
  data,
  selected,
}: NodeProps) {
  const d = data as unknown as FunctionNodeData;

  if (d.isHidden) {
    return (
      <>
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <div
          style={{ borderColor: "#555" }}
          className="flex min-w-[120px] items-center justify-center rounded-md border border-dashed bg-card px-3 py-2 text-xs text-muted-foreground"
        >
          {d.label}
        </div>
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      </>
    );
  }

  const ringStyle = d.isSelected || selected
    ? `ring-2 ring-offset-1 ring-offset-background`
    : "";

  const badgeLabel: Record<Category, string> = {
    entry: "entry",
    core: "core",
    data: "data",
    helper: "helper",
  };

  const shortFile = d.file
    ? d.file.split("/").slice(-2).join("/")
    : undefined;

  return (
    <>
      {/* Left handle – receives caller edges */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: d.color, borderColor: d.color, width: 8, height: 8 }}
      />

      <div
        className={`
          group flex min-w-[160px] max-w-[220px] cursor-pointer flex-col gap-0.5
          rounded-lg border bg-card px-3 py-2 shadow-sm transition-shadow hover:shadow-md
          ${d.isSelected ? "border-primary/80" : "border-border"}
          ${ringStyle}
        `}
        style={d.isSelected ? { borderColor: d.color } : undefined}
      >
        {/* Category badge */}
        <span
          className="mb-1 w-fit rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: `${d.color}22`, color: d.color }}
        >
          {badgeLabel[d.category]}
          {d.selfCall && " · recursive"}
        </span>

        {/* Function name */}
        <span
          className="truncate text-xs font-semibold leading-snug text-foreground"
          title={d.label}
        >
          {d.label}
        </span>

        {/* File path */}
        {shortFile && (
          <span
            className="truncate font-mono text-[9px] text-muted-foreground"
            title={d.file}
          >
            {shortFile}
          </span>
        )}
      </div>

      {/* Right handle – sends callee edges */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: d.color, borderColor: d.color, width: 8, height: 8 }}
      />
    </>
  );
});
