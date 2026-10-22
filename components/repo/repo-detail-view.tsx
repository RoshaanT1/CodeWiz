"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CallMap, type CallMapFunction, type CallMapCall } from "@/components/call-map";
import {
  RepoGraphWorkspace,
  transformRepoToGraph,
  type AnalysisStatus,
} from "@/components/repo-graph";

export type RepoFunctionItem = {
  id: string;
  name: string;
  qualifiedName: string | null;
  filePath: string;
  language: string | null;
  startLine: number | null;
  endLine: number | null;
  code: string | null;
  branches: number | null;
  callers: number | null;
  callees: number | null;
  category: "entry" | "core" | "data" | "helper" | null;
  importance: number | null;
  explained: boolean;
};

export type RepoDetailProps = {
  repo: {
    id: string;
    owner: string;
    name: string;
    branch: string;
    commitSha?: string | null;
    url: string;
    status: string;
    fileCount: number;
    functionCount: number;
    folder: string | null;
  };
  functions: RepoFunctionItem[];
  callCount: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  entry: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
  core: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  data: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  helper: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
};

export function RepoDetailView({ repo, functions, callCount }: RepoDetailProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Call map selected function id
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(() => functions[0]?.id ?? null);

  // Round modal state
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [roundSize, setRoundSize] = useState<3 | 5 | 10>(3);
  const [startingRound, setStartingRound] = useState(false);
  const [roundError, setRoundError] = useState<string | null>(null);

  // Indexing state
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  // Build CallMap data structures from functions + call count placeholder
  // (we show the full function list; the map API /api/repos/functions returns call edges)
  const callMapFunctions: CallMapFunction[] = useMemo(
    () =>
      functions.map((fn) => ({
        id: fn.id,
        name: fn.qualifiedName ?? fn.name,
        file: fn.filePath,
        category: (fn.category ?? "helper") as CallMapFunction["category"],
      })),
    [functions],
  );

  // Actual edges loaded via the call-map API or on mount
  const [callMapCalls, setCallMapCalls] = useState<CallMapCall[]>([]);
  const [callMapLoading, setCallMapLoading] = useState(false);

  // Auto-fetch call edges on mount if repo is indexed so graph has relationships immediately
  useEffect(() => {
    if (repo.status === "indexed" && callMapCalls.length === 0) {
      let isMounted = true;
      fetch(`/api/repos/functions?repo_id=${repo.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (isMounted && json?.ok && json.data?.calls) {
            setCallMapCalls(json.data.calls);
          }
        })
        .catch(() => {
          // Non-critical background call load
        });
      return () => {
        isMounted = false;
      };
    }
  }, [repo.id, repo.status, callMapCalls.length]);

  async function loadCallEdges(fnId: string) {
    if (callMapCalls.length > 0) {
      setMapSelectedId(fnId);
      return;
    }
    setCallMapLoading(true);
    try {
      const res = await fetch(`/api/repos/functions?repo_id=${repo.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data?.calls) {
          setCallMapCalls(json.data.calls);
        }
      }
    } finally {
      setCallMapLoading(false);
    }
    setMapSelectedId(fnId);
  }

  // Transform repository structure, files, and functions into full interactive 3D graph
  const repoGraph = useMemo(() => {
    return transformRepoToGraph(
      {
        id: repo.id,
        name: repo.name,
        owner: repo.owner,
        branch: repo.branch,
        commitSha: repo.commitSha,
        status: repo.status,
        url: repo.url,
      },
      functions,
      callMapCalls
    );
  }, [repo, functions, callMapCalls]);

  const analysisStatus: AnalysisStatus = useMemo(() => {
    if (indexing) return "scanning";
    if (repo.status === "indexed") return "ready";
    if (repo.status === "pending") return "queued";
    if (repo.status === "fetching") return "fetching";
    if (repo.status === "failed") return "failed";
    return "ready";
  }, [indexing, repo.status]);

  // Filtered functions
  const filteredFunctions = useMemo(() => {
    return functions.filter((fn) => {
      const matchesSearch =
        search.trim() === "" ||
        fn.name.toLowerCase().includes(search.toLowerCase()) ||
        (fn.qualifiedName && fn.qualifiedName.toLowerCase().includes(search.toLowerCase())) ||
        fn.filePath.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || fn.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [functions, search, selectedCategory]);

  const eligibleCount = useMemo(() => {
    return functions.filter((f) => !f.explained && (f.importance ?? 0) > 0).length;
  }, [functions]);

  async function handleIndexRepo() {
    setIndexing(true);
    setIndexError(null);
    try {
      const res = await fetch(`/api/repos/${repo.id}/index`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        router.refresh();
      } else {
        setIndexError(json.error?.message ?? "Failed to index repo.");
      }
    } catch {
      setIndexError("Network error while indexing repo.");
    } finally {
      setIndexing(false);
    }
  }

  async function handleStartRound() {
    setStartingRound(true);
    setRoundError(null);
    try {
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: repo.id, size: roundSize }),
      });
      const json = await res.json();
      if (json.ok) {
        router.push(`/rounds/${json.data.id}`);
      } else {
        setRoundError(json.error?.message ?? "Failed to create round.");
      }
    } catch {
      setRoundError("Network error starting round.");
    } finally {
      setStartingRound(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {repo.owner}/{repo.name}
            </h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                repo.status === "indexed"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
              }`}
            >
              {repo.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Branch: <span className="font-mono">{repo.branch}</span>
            {repo.folder && <> · Folder: <span className="font-mono">{repo.folder}</span></>}
            {" · "}
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:opacity-80"
            >
              View on GitHub
            </a>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {repo.status !== "indexed" ? (
            <Button onClick={handleIndexRepo} disabled={indexing}>
              {indexing ? "Indexing Repo (parsing AST)…" : "Index Repo Now"}
            </Button>
          ) : (
            <Button
              onClick={() => setShowRoundModal(true)}
              disabled={eligibleCount < 3}
              className="bg-primary text-primary-foreground shadow"
            >
              Start Practice Round
            </Button>
          )}
        </div>
      </div>

      {indexError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {indexError}
        </div>
      )}

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Total Functions
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{repo.functionCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Call Graph Edges
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{callCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Files Parsed
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{repo.fileCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Eligible for Rounds
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{eligibleCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 3D Interactive Repository Graph Workspace */}
      <RepoGraphWorkspace
        graph={repoGraph}
        status={analysisStatus}
        repoUrl={repo.url}
        onRefreshAnalysis={handleIndexRepo}
        onStartRoundWithFunction={(fnId) => {
          setMapSelectedId(fnId);
          setShowRoundModal(true);
        }}
        onFocusNode={(nodeId: string) => {
          const fn = functions.find((f) => f.id === nodeId);
          if (fn) {
            setMapSelectedId(fn.id);
          }
        }}
      />

      {/* Function Browser Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Indexed Functions</CardTitle>
          <CardDescription>
            Parsed static functions, importance weights, and callers graph.
          </CardDescription>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder="Search function name or file path..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "entry", "core", "data", "helper"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredFunctions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {repo.status !== "indexed"
                ? "This repository has not been indexed yet. Click 'Index Repo Now' above."
                : "No functions match your current filter."}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {filteredFunctions.map((fn) => {
                const isExpanded = expandedId === fn.id;
                const catClass =
                  fn.category && CATEGORY_COLORS[fn.category]
                    ? CATEGORY_COLORS[fn.category]
                    : CATEGORY_COLORS.helper;

                return (
                  <div key={fn.id} className="p-4 transition-colors hover:bg-muted/40">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-semibold text-foreground">
                            {fn.qualifiedName || fn.name}
                          </span>
                          {fn.category && (
                            <span
                              className={`rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${catClass}`}
                            >
                              {fn.category}
                            </span>
                          )}
                          {fn.explained && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              Explained
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {fn.filePath}:{fn.startLine}-{fn.endLine}
                          {fn.language && ` (${fn.language})`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs text-muted-foreground">
                          <div>
                            <span className="font-semibold text-foreground">
                              {fn.importance?.toFixed(2) ?? "0.00"}
                            </span>{" "}
                            importance
                          </div>
                          <div>
                            {fn.callers ?? 0} callers · {fn.callees ?? 0} callees · {fn.branches ?? 0} branches
                          </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMapSelectedId(fn.id);
                              loadCallEdges(fn.id);
                              // scroll to call map
                              setTimeout(() => {
                                document.getElementById("call-map-section")?.scrollIntoView({ behavior: "smooth" });
                              }, 100);
                            }}
                            className="text-xs"
                          >
                            View Map
                          </Button>
                        {fn.code && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedId(isExpanded ? null : fn.id)}
                            className="text-xs"
                          >
                            {isExpanded ? "Hide Code" : "View Code"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && fn.code && (
                      <div className="mt-4 rounded-md bg-zinc-950 p-4 text-xs font-mono text-zinc-100 overflow-x-auto">
                        <pre>
                          <code>{fn.code}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Map Section */}
      {repo.status === "indexed" && callMapFunctions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl">Call Graph</CardTitle>
                <CardDescription>
                  Select a function to see its callers (left) and callees (right).
                </CardDescription>
              </div>
              {mapSelectedId && (
                <span className="font-mono text-xs text-muted-foreground">
                  {callMapFunctions.find((f) => f.id === mapSelectedId)?.name ?? mapSelectedId}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!mapSelectedId ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Click &ldquo;View Map&rdquo; on any function below to see its graph.
              </div>
            ) : callMapLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground animate-pulse">
                Loading call edges…
              </div>
            ) : (
              <div style={{ height: 360 }}>
                <CallMap
                  functions={callMapFunctions}
                  calls={callMapCalls}
                  selectedId={mapSelectedId}
                  onSelect={(id) => setMapSelectedId(id)}
                  maxNodes={12}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Start Round Modal */}
      {showRoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-lg border">
            <CardHeader>
              <CardTitle>Start Practice Round</CardTitle>
              <CardDescription>
                AI will select key functions from this repo to quiz your understanding and test your bug-spotting skills.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Round Size</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([3, 5, 10] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      disabled={eligibleCount < size}
                      onClick={() => setRoundSize(size)}
                      className={`rounded-md border p-3 text-center transition-all ${
                        roundSize === size
                          ? "border-primary bg-primary/10 font-bold text-primary"
                          : "border-border hover:bg-muted text-foreground"
                      } ${eligibleCount < size ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <div className="text-lg">{size}</div>
                      <div className="text-xs text-muted-foreground">
                        {size === 3 ? "Quick" : size === 5 ? "Standard" : "Deep Dive"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {roundError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {roundError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRoundModal(false)}
                  disabled={startingRound}
                >
                  Cancel
                </Button>
                <Button onClick={handleStartRound} disabled={startingRound}>
                  {startingRound ? "Selecting Functions with AI..." : `Start (${roundSize} Functions)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
