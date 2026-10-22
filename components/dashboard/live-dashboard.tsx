"use client";

import { ArrowRight, Github, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { EmptyState, PageTitle, SectionTitle } from "@/components/app-shell/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/client/post-json";
import type { WorkspaceRepo, WorkspaceRound } from "@/lib/quiz/load-workspace";

/** UI-1: real repos, import and recent rounds. */
export function LiveDashboard({ name, repos, rounds }: { name: string; repos: WorkspaceRepo[]; rounds: WorkspaceRound[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [folder, setFolder] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError("Enter a GitHub repository URL, such as https://github.com/owner/project.");
      return;
    }
    setError(null);
    setImporting(true);
    const res = await postJson<{ repoId: string }>("/api/repos", folder.trim() ? { url: url.trim(), folder: folder.trim().replace(/^\/+|\/+$/g, "") } : { url: url.trim() });
    if (!res.ok) {
      setImporting(false);
      setError(res.message);
      return;
    }
    router.push(`/repo/${res.data.repoId}`);
  }

  return (
    <div className="mx-auto max-w-[1040px] fade-in">
      <PageTitle eyebrow="Workspace" title={`Welcome back, ${name}`} description="Import a public GitHub repo, then practise reading its most important functions." />

      <section className="mb-9 rounded-md border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Import a repository</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Public repos with Python, JavaScript or TypeScript. We read the code; we never run it. Large repos can take up to a minute.
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repository"
            aria-label="GitHub repository URL"
            disabled={importing}
            data-testid="input-repository-url"
          />
          <Button type="submit" disabled={importing} data-testid="button-import-repository">
            {importing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Importing…
              </>
            ) : (
              <>
                <Plus size={14} /> Import repo
              </>
            )}
          </Button>
        </form>
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <label htmlFor="import-folder" className="shrink-0 text-xs text-muted-foreground">
            Big repo? Import one folder:
          </label>
          <Input
            id="import-folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="src/core (optional)"
            disabled={importing}
            className="h-8 text-xs sm:max-w-xs"
            data-testid="input-repository-folder"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">We read up to 150 source files. For larger repos, pick the folder you want to learn.</p>
        {error && (
          <p className="mt-2 text-xs text-destructive" role="alert" data-testid="status-import-error">
            {error}
          </p>
        )}
      </section>

      <section className="mb-9">
        <SectionTitle aside={<span className="text-xs text-muted-foreground">{repos.length} repositories</span>}>Your repositories</SectionTitle>
        {repos.length === 0 ? (
          <EmptyState title="No repositories yet" text="Import one above to get started." />
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            {repos.map((repo, i) => (
              <Link
                href={`/repo/${repo.id}`}
                key={repo.id}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/50 ${i ? "border-t" : ""}`}
                data-testid={`repo-row-${repo.id}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
                    <Github size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {repo.owner}/{repo.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {repo.status === "indexed" ? `${repo.functionCount} functions` : repo.status === "failed" ? "Import failed" : "Importing…"}
                    </span>
                  </span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Recent rounds</SectionTitle>
        {rounds.length === 0 ? (
          <EmptyState title="No practice rounds yet" text="Open a repository and start a round of 3, 5 or 10 functions." />
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            {rounds.map((r, i) => (
              <Link
                key={r.id}
                href={r.status === "completed" ? `/results/${r.id}` : `/round/${r.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 ${i ? "border-t" : ""}`}
                data-testid={`round-row-${r.id}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.repo}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()} · {r.size} functions
                  </span>
                </span>
                <Badge variant={r.status === "completed" ? "outline" : "secondary"}>{r.status === "completed" ? "See results" : "In progress"}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
