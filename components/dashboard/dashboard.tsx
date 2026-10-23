"use client";

import { ArrowRight, GitBranch, Github, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { EmptyState, PageTitle, SectionTitle } from "@/components/app-shell/page-parts";
import { useWorkspace } from "@/components/app-shell/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { repos as seedRepos, type Repository } from "@/lib/demo/mock-data";

function repoCoverage(repo: Repository) {
  return repo.functions.length
    ? Math.round((repo.functions.filter((fn) => fn.reviewed).length * 100) / repo.functions.length)
    : 0;
}

export function Dashboard() {
  const router = useRouter();
  const { user, repositories: repos, addRepository, rounds, setCurrentRoundId } = useWorkspace();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  function onOpen(id: string) {
    setCurrentRoundId(id);
    const done = rounds.find((r) => r.id === id)?.status === "completed";
    router.push(done ? `/results/${id}` : `/round/${id}`);
  }

  // Demo import: copies the sample functions under the new repo's name.
  // Replace with POST /api/repos once IMPORT lands.
  function submit(e: FormEvent) {
    e.preventDefault();
    const match = url.trim().match(/github\.com\/([^/]+)\/([^/#?]+)/);
    if (!match) {
      setError("Enter a valid GitHub repository URL, such as github.com/owner/project.");
      return;
    }
    setError("");
    setImporting(true);
    window.setTimeout(() => {
      const [owner, name] = match.slice(1);
      const slug = name.replace(/\.git$/, "").toLowerCase();
      if (repos.some((r) => r.id === slug)) {
        setError("This repository is already in your workspace.");
        setImporting(false);
        return;
      }
      const source = seedRepos[0];
      const idMap = new Map(source.functions.map((fn) => [fn.id, `${slug}-${fn.id}`]));
      const functions = source.functions.map((fn) => ({
        ...fn,
        id: idMap.get(fn.id) ?? fn.id,
        file: fn.file.replace(/^src\//, `${slug}/src/`),
        reviewed: false,
      }));
      const calls = source.calls.map((call) => ({
        callerId: idMap.get(call.callerId) ?? call.callerId,
        calleeId: idMap.get(call.calleeId) ?? call.calleeId,
      }));
      addRepository({
        id: slug,
        name: slug,
        owner,
        url: `https://github.com/${owner}/${slug}`,
        language: source.language,
        branch: "main",
        updated: "Just imported",
        rounds: 0,
        functions,
        calls,
      });
      setUrl("");
      setImporting(false);
    }, 650);
  }

  return (
    <div className="mx-auto max-w-[1040px] fade-in">
      <PageTitle
        eyebrow="Workspace"
        title={`Good morning, ${user.name.split(" ")[0]}`}
        description="Pick up where you left off, or explore a function in one of your repositories."
      />
      <section className="mb-9">
        <SectionTitle aside={<span className="text-xs text-muted-foreground">{repos.length} repositories</span>}>
          Your repositories
        </SectionTitle>
        <div className="overflow-hidden rounded-md border bg-card">
          {repos.map((repo, i) => (
            <Link
              href={`/repo/${repo.id}`}
              key={repo.id}
              className={`flex flex-col justify-between gap-3 px-4 py-3.5 hover:bg-muted/50 sm:flex-row sm:items-center ${i ? "border-t" : ""}`}
              data-testid={`repo-row-${repo.id}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-background">
                  <Github size={16} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {repo.owner}/{repo.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{repo.language}</span>
                    <span>·</span>
                    <span>{repo.functions.length} functions</span>
                    <span>·</span>
                    <span data-testid={`repo-coverage-${repo.id}`}>{repoCoverage(repo)}% coverage</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-5 pl-11 text-xs text-muted-foreground sm:pl-0">
                <span className="flex items-center gap-1">
                  <GitBranch size={13} />
                  {repo.branch}
                </span>
                <span>{repo.updated}</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="mb-9 rounded-md border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-muted p-2">
            <Github size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Import a repository</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a GitHub URL to start exploring functions. Imports are simulated in this demo.
            </p>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                aria-label="GitHub repository URL"
                data-testid="input-repository-url"
              />
              <Button type="submit" disabled={importing} data-testid="button-import-repository">
                {importing ? (
                  "Importing…"
                ) : (
                  <>
                    <Plus size={14} />
                    Import repo
                  </>
                )}
              </Button>
            </form>
            {error && (
              <p className="mt-2 text-xs text-destructive" data-testid="status-import-error">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
      <section>
        <SectionTitle aside={<span className="text-xs text-muted-foreground">Latest activity</span>}>
          Recent rounds
        </SectionTitle>
        {rounds.length === 0 ? (
          <EmptyState title="No practice rounds yet" text="Open a repository and start with a few functions." />
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            {rounds.slice(0, 5).map((r, i) => (
              <button
                key={r.id}
                onClick={() => onOpen(r.id)}
                className={`flex w-full flex-col justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 sm:flex-row sm:items-center ${i ? "border-t" : ""}`}
                data-testid={`round-row-${r.id}`}
              >
                <span>
                  <span className="text-sm font-medium">{r.repoName}</span>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">{r.id}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {r.date} · {r.functionIds.length} functions
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  {r.status === "completed" ? (
                    <>
                      <span className="text-xs text-muted-foreground">{r.bugsFound} bugs found</span>
                      <span className="font-mono text-sm font-semibold text-primary">
                        {r.score}
                        <span className="text-xs font-normal text-muted-foreground"> / 100</span>
                      </span>
                    </>
                  ) : (
                    <Badge variant="secondary">In progress</Badge>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
