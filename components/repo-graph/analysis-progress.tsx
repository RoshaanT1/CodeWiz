"use client";

import { useEffect, useState } from "react";
import type { AnalysisStatus } from "./graph-types";

export type AnalysisProgressProps = {
  status: AnalysisStatus;
  repoUrl?: string;
  onCancel?: () => void;
};

const STATUS_DETAILS: Record<
  AnalysisStatus,
  { title: string; subtitle: string; playfulQuote: string }
> = {
  queued: {
    title: "Analysis Queued",
    subtitle: "Waiting for worker container slot...",
    playfulQuote: "Warming up the syntax engines...",
  },
  fetching: {
    title: "Fetching Repository",
    subtitle: "Checking commit SHA, files, and directory structure...",
    playfulQuote: "Cloning the tree-top branches...",
  },
  scanning: {
    title: "Scanning Repository",
    subtitle: "Filtering generated files, dependencies, binaries, and vendor paths...",
    playfulQuote: "Separating signal from vendor noise...",
  },
  parsing: {
    title: "Reading Code Structure",
    subtitle: "Parsing ASTs with web-tree-sitter in WebAssembly...",
    playfulQuote: "Untangling the spaghetti...",
  },
  building_graph: {
    title: "Connecting the Pieces",
    subtitle: "Building the repository dependency and call graph...",
    playfulQuote: "The functions are introducing themselves...",
  },
  partial: {
    title: "The Graph is Partially Ready",
    subtitle: "Some files or relationships are still being analyzed.",
    playfulQuote: "Rendering the known universe...",
  },
  ready: {
    title: "Repository Graph Ready",
    subtitle: "Functions and relationships mapped.",
    playfulQuote: "Nothing suspicious here... yet.",
  },
  failed: {
    title: "Analysis Failed",
    subtitle: "Could not parse or map the repository.",
    playfulQuote: "Hit a roadblock in the abstract syntax tree.",
  },
  cancelled: {
    title: "Analysis Cancelled",
    subtitle: "Operation was aborted.",
    playfulQuote: "Stopped in mid-flight.",
  },
};

export function AnalysisProgress({ status, repoUrl, onCancel }: AnalysisProgressProps) {
  const [dotCount, setDotCount] = useState(1);
  const details = STATUS_DETAILS[status] || STATUS_DETAILS.queued;

  useEffect(() => {
    const timer = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 450);
    return () => clearInterval(timer);
  }, []);

  const dots = ".".repeat(dotCount);

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-8 text-center backdrop-blur-xl">
      {/* Playful rotating isometric cube */}
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="h-10 w-10 animate-spin-slow rounded-lg border-2 border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/20 transform rotate-12" />
        <div className="absolute h-6 w-6 rounded border border-emerald-400 bg-emerald-500/20 transform -rotate-12" />
      </div>

      <div className="space-y-1">
        <h4 className="font-mono text-base font-bold text-zinc-100">
          {details.title}
          <span className="text-cyan-400 inline-block w-4 text-left">{dots}</span>
        </h4>
        <p className="max-w-md font-mono text-xs text-zinc-400">
          {details.subtitle}
        </p>
        <p className="font-mono text-[11px] italic text-zinc-500 pt-1">
          &ldquo;{details.playfulQuote}&rdquo;
        </p>
      </div>

      {repoUrl && (
        <span className="rounded bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
          {repoUrl}
        </span>
      )}

      {onCancel && (
        <button
          onClick={onCancel}
          className="text-xs font-mono text-zinc-500 hover:text-zinc-300 hover:underline pt-2"
        >
          Cancel Analysis
        </button>
      )}
    </div>
  );
}
