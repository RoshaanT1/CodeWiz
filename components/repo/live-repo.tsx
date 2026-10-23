"use client";

import { CheckCircle2, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState, PageTitle, SectionTitle } from "@/components/app-shell/page-parts";
import { CallMap, type Category } from "@/components/call-map";
import { MetricsPanel } from "@/components/metrics/metrics-panel";
import { RepoGraphWorkspace, transformRepoToGraph } from "@/components/repo-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/client/post-json";
import type { RepoDetail } from "@/lib/quiz/load-workspace";

const CATEGORIES = ["all", "entry", "core", "data", "helper"] as const;
const SIZES = [3, 5, 10] as const;

/** MAP-1: browse a repo's functions and start a round. */
export function LiveRepo({ repo, showMetrics = false }: { repo: RepoDetail; showMetrics?: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]>(3);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(repo.functions[0]?.id ?? "");
  const [functions, setFunctions] = useState(repo.functions);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const selected = functions.find((f) => f.id === selectedId);
  const [view, setView] = useState<"map" | "graph">("map");
  const repoGraph = useMemo(
    () =>
      transformRepoToGraph(
        { id: repo.id, owner: repo.owner, name: repo.name, status: repo.status },
        repo.functions.map((f) => ({
          id: f.id,
          name: f.name,
          qualifiedName: f.name,
          filePath: f.file,
          category: f.category as Category,
          importance: f.importance,
          callers: f.metrics.callers,
          callees: f.metrics.callees,
          branches: f.metrics.branches,
          dataAccess: f.metrics.dataAccess,
          explained: !f.eligible,
        })),
        repo.calls,
      ),
    [repo],
  );

  async function explain() {
    if (!selected) return;
    setExplaining(true);
    setExplainError(null);
    const res = await postJson<{ functionId: string; explanation: string }>(`/api/functions/${selected.id}/explain`);
    setExplaining(false);
    if (!res.ok) {
      setExplainError(res.message);
      return;
    }
    setExplanations((old) => ({ ...old, [res.data.functionId]: res.data.explanation }));
    setFunctions((old) => old.map((f) => (f.id === res.data.functionId ? { ...f, eligible: false } : f)));
  }
  const mapFunctions = useMemo(
    () => repo.functions.map((f) => ({ id: f.id, name: f.name, file: f.file, category: f.category as Category })),
    [repo.functions],
  );

  const shown = useMemo(
    () =>
      functions.filter(
        (f) => (category === "all" || f.category === category) && (!query || f.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [functions, category, query],
  );
  const eligible = functions.filter((f) => f.eligible && !f.reviewed).length;

  async function start() {
    setStarting(true);
    setError(null);
    const res = await postJson<{ roundId: string }>("/api/rounds", { repoId: repo.id, size });
    if (!res.ok) {
      setStarting(false);
      setError(res.message);
      return;
    }
    router.push(`/round/${res.data.roundId}`);
  }

  return (
    <div className="mx-auto max-w-[1040px] fade-in">
      <PageTitle
        eyebrow="Repository"
        title={`${repo.owner}/${repo.name}`}
        description={`${functions.length} functions · ${eligible} ready for practice`}
      />

      {repo.status !== "indexed" ? (
        <EmptyState
          title={repo.status === "failed" ? "This import failed" : "Still importing"}
          text={repo.status === "failed" ? "Go back to the dashboard and import it again." : "Refresh in a moment."}
        />
      ) : (
        <>
          <section className="mb-7 rounded-md border bg-card p-4">
            <h2 className="text-sm font-semibold">Start a round</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The AI picks important functions you haven&apos;t reviewed. For each one: a short quiz, then a bug drill.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {SIZES.map((s) => (
                <Button key={s} variant={size === s ? "default" : "outline"} size="sm" onClick={() => setSize(s)} data-testid={`button-size-${s}`}>
                  {s} functions
                </Button>
              ))}
              <Button onClick={() => void start()} disabled={starting || eligible === 0} data-testid="button-start-round">
                {starting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Picking functions…
                  </>
                ) : (
                  "Start round"
                )}
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </section>

          <section className="mb-7">
            <SectionTitle
              aside={
                <div className="flex gap-1" role="tablist" aria-label="Map view">
                  {(
                    [
                      ["map", "Call map"],
                      ["graph", "Repo graph"],
                    ] as const
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={view === key ? "secondary" : "ghost"}
                      role="tab"
                      aria-selected={view === key}
                      onClick={() => setView(key)}
                      data-testid={`tab-${key}`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              }
            >
              {view === "map" ? "Call map" : "Repository graph"}
            </SectionTitle>
            {view === "map" ? (
              <div className="h-[360px] overflow-hidden rounded-md border bg-card">
                <CallMap functions={mapFunctions} calls={repo.calls} selectedId={selectedId} onSelect={setSelectedId} maxNodes={6} />
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border bg-card" data-testid="repo-graph">
                <RepoGraphWorkspace
                  graph={repoGraph}
                  status="ready"
                  onStartRoundWithFunction={(fnId) => {
                    setSelectedId(fnId);
                    setView("map");
                  }}
                />
              </div>
            )}
            <div className={`mt-2 flex-wrap gap-3 text-[11px] text-muted-foreground ${view === "map" ? "flex" : "hidden"}`}>
              {[
                ["entry", "#2563eb"],
                ["core", "#059669"],
                ["data", "#d97706"],
                ["helper", "#6b7280"],
              ].map(([name, color]) => (
                <span key={name} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                  {name}
                </span>
              ))}
            </div>
            {selected && (
              <div className="mt-3 rounded-md border bg-card p-4" data-testid="explain-panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{selected.name}</span>
                  {!explanations[selected.id] && (
                    <Button size="sm" variant="outline" onClick={() => void explain()} disabled={explaining} data-testid="button-explain">
                      {explaining ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Explaining…
                        </>
                      ) : (
                        "Explain this function"
                      )}
                    </Button>
                  )}
                </div>
                {explanations[selected.id] ? (
                  <div className="mt-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Explanation · AI-generated</div>
                    <p className="mt-1 text-sm leading-6">{explanations[selected.id]}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Seeing the explanation leaves this function out of future quizzes, since you&apos;ll already know the answers.
                  </p>
                )}
                {explainError && (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {explainError}
                  </p>
                )}
                {showMetrics && <MetricsPanel metrics={selected.metrics} />}
              </div>
            )}
          </section>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <Button key={c} variant={category === c ? "secondary" : "ghost"} size="sm" onClick={() => setCategory(c)}>
                  {c === "all" ? "All" : c}
                </Button>
              ))}
            </div>
            <div className="relative sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search functions" className="pl-8" aria-label="Search functions" />
            </div>
          </div>

          {shown.length === 0 ? (
            <EmptyState title="No matching functions" text="Try another category or search." />
          ) : (
            <div className="divide-y overflow-hidden rounded-md border bg-card">
              {shown.slice(0, 200).map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/50 ${selectedId === f.id ? "bg-accent" : ""}`}
                  data-testid={`function-row-${f.id}`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{f.name}</span>
                      {f.reviewed && <CheckCircle2 size={13} className="shrink-0 text-emerald-600" aria-label="Reviewed" />}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{f.file}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {!f.eligible && <span className="text-[11px] text-muted-foreground">Skipped</span>}
                    <Badge variant="outline">{f.category}</Badge>
                    <span className="w-10 text-right font-mono text-xs text-muted-foreground">{f.importance.toFixed(1)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
