"use client";

import { ArrowRight, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  EmptyState,
  NotFoundMessage,
  PageTitle,
  SectionTitle,
} from "@/components/app-shell/page-parts";
import { useWorkspace } from "@/components/app-shell/workspace-provider";
import { CallMap } from "@/components/call-map/call-map";
import { CodeViewer } from "@/components/code-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const categories = ["all", "entry", "core", "data", "helper"] as const;

export function RepoPage({ repoId }: { repoId: string }) {
  const { repositories, startRound } = useWorkspace();
  const repo = repositories.find((r) => r.id === repoId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string | null>(repo?.functions[0]?.id ?? null);
  const [picker, setPicker] = useState(false);
  const [count, setCount] = useState(3);

  const filtered = useMemo(
    () =>
      repo?.functions.filter(
        (f) =>
          (category === "all" || f.category === category) &&
          `${f.name} ${f.qualifiedName} ${f.file}`.toLowerCase().includes(query.toLowerCase()),
      ) ?? [],
    [repo, category, query],
  );

  if (!repo) return <NotFoundMessage />;
  const fn = repo.functions.find((f) => f.id === selected) ?? filtered[0];

  return (
    <div className="mx-auto max-w-[1160px] fade-in">
      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground">{repo.name}</span>
      </div>
      <PageTitle
        eyebrow={`${repo.owner} / ${repo.name}`}
        title={repo.name}
        description={`${repo.language} · ${repo.branch} · Updated ${repo.updated}`}
        action={
          <Button onClick={() => setPicker(true)} data-testid="button-start-round">
            <Plus size={14} />
            New round
          </Button>
        }
      />
      {repo.functions.length === 0 ? (
        <EmptyState
          title="No functions indexed"
          text="This demo import is saved locally. The sample function explorer is available in tiny-cache."
        />
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(250px,0.78fr)_minmax(0,1.5fr)]">
          <section className="min-w-0">
            <SectionTitle aside={<span className="font-mono text-xs text-muted-foreground">{filtered.length}</span>}>
              Functions
            </SectionTitle>
            <div className="mb-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 pl-8"
                  placeholder="Find a function…"
                  data-testid="input-function-search"
                />
              </div>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded px-2 py-1 text-[11px] capitalize ${category === c ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  data-testid={`filter-category-${c}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="overflow-hidden rounded-md border bg-card">
              {filtered.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f.id)}
                  className={`w-full border-b px-3 py-3 text-left last:border-b-0 ${selected === f.id ? "bg-accent/70" : "hover:bg-muted/50"}`}
                  data-testid={`function-item-${f.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-medium">{f.qualifiedName}</div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {f.startLine}–{f.endLine}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{f.file}</span>
                    <span className="capitalize">{f.category}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">Importance {f.importance}</span>
                    <Badge variant={f.reviewed ? "secondary" : "outline"}>
                      {f.reviewed ? "Reviewed" : "Not reviewed"}
                    </Badge>
                  </div>
                </button>
              ))}
              {!filtered.length && (
                <div className="p-5 text-center text-xs text-muted-foreground">No functions match.</div>
              )}
            </div>
          </section>
          {fn && (
            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{fn.name}</h2>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {fn.file}:{fn.startLine}–{fn.endLine}
                  </div>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {fn.category}
                </Badge>
              </div>
              <CodeViewer fn={fn} selectedLines={[]} />
              <div className="my-3 grid grid-cols-2 divide-x rounded-md border bg-card sm:grid-cols-5">
                {(
                  [
                    ["Importance", `${fn.importance}/100`],
                    ["Length", fn.length],
                    ["Branches", fn.branches],
                    ["Callers", fn.callers],
                    ["Callees", fn.callees],
                  ] as const
                ).map(([label, val]) => (
                  <div key={label} className="border-b px-3 py-2.5 last:border-0 sm:border-b-0">
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                    <div className="mt-1 font-mono text-sm font-medium">{val}</div>
                  </div>
                ))}
              </div>
              <CallMap functions={repo.functions} calls={repo.calls} activeId={fn.id} onSelect={setSelected} />
            </section>
          )}
        </div>
      )}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" onClick={() => setPicker(false)}>
          <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Start a practice round</h2>
              <button onClick={() => setPicker(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Choose how many functions to work through.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[3, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`rounded-md border px-3 py-3 text-center ${count === n ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                  data-testid={`round-size-${n}`}
                >
                  <div className="font-mono text-lg font-semibold">{n}</div>
                  <div className="text-[11px] text-muted-foreground">functions</div>
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPicker(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => startRound(repo.id, repo.functions.slice(0, count).map((f) => f.id))}
                data-testid="button-confirm-round"
              >
                Begin round <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
