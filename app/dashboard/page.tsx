import type { Metadata } from "next";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { RepoPreview } from "@/components/repo-preview/repo-preview";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAal2User } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard · CodeWiz" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAal2User("/dashboard");
  const client = await createClient();
  const { data: userRepos } = client.ok
    ? await client.data
        .from("repos")
        .select("id, owner, name, branch, status, file_count, function_count, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const repos = userRepos ?? [];

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-80">
            CodeWiz
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/profile">Profile</Link>
            </Button>
            <span className="hidden max-w-[14rem] truncate px-2 text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Map a GitHub repo, then quiz yourself and spot the bugs.
          </p>
        </div>

        {/* ── Empty state — no repos yet ───────────────────────────── */}
        {repos.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-3xl">
                🗂️
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Import your first repo</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Paste a public GitHub URL below. CodeWiz will parse every
                  function, build a call graph, and generate quizzes and
                  bug&nbsp;drills for the functions that matter most.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                ↓ Use the form below to get started
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Existing repositories ────────────────────────────────── */}
        {repos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Your Repositories ({repos.length})
              </CardTitle>
              <CardDescription>
                Repositories mapped and ready for practice rounds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border">
                {repos.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {r.owner}/{r.name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            r.status === "indexed"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Branch: {r.branch} · {r.function_count ?? 0} functions
                        · {r.file_count ?? 0} files
                      </p>
                    </div>

                    <Button asChild size="sm">
                      <Link href={`/repos/${r.id}`}>Open Repo Map →</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Import form ──────────────────────────────────────────── */}
        <RepoPreview />
      </main>
    </div>
  );
}
