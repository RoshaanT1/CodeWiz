"use client";

import { CheckCircle2, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState, PageTitle } from "@/components/app-shell/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/client/post-json";
import type { RepoDetail } from "@/lib/quiz/load-workspace";

const CATEGORIES = ["all", "entry", "core", "data", "helper"] as const;
const SIZES = [3, 5, 10] as const;

/** MAP-1: browse a repo's functions and start a round. */
export function LiveRepo({ repo }: { repo: RepoDetail }) {
  const router = useRouter();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]>(3);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(
    () =>
      repo.functions.filter(
        (f) => (category === "all" || f.category === category) && (!query || f.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [repo.functions, category, query],
  );
  const eligible = repo.functions.filter((f) => f.eligible && !f.reviewed).length;

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
        description={`${repo.functions.length} functions · ${eligible} ready for practice`}
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
                <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5" data-testid={`function-row-${f.id}`}>
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
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
