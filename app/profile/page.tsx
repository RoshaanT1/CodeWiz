import type { Metadata } from "next";
import Link from "next/link";

import { requireAal2User } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AiKeySettings } from "@/components/profile/ai-key-settings";

export const metadata: Metadata = { title: "Profile · CodeWiz" };
export const dynamic = "force-dynamic";

const BUG_TYPE_LABELS: Record<string, string> = {
  off_by_one: "Off-by-one",
  wrong_condition: "Wrong condition",
  missing_guard: "Missing guard",
  wrong_variable: "Wrong variable",
  swallowed_error: "Swallowed error",
  wrong_return: "Wrong return",
  unchecked_input: "Unchecked input",
  async_mistake: "Async mistake",
  mutable_default: "Mutable default",
};

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(v),
  );
}

export default async function ProfilePage() {
  const user = await requireAal2User("/dashboard");

  const client = await createClient();
  if (!client.ok) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-destructive">Database connection error.</p>
      </div>
    );
  }

  // ── Parallel data loads ───────────────────────────────────────────────────
  const [
    { data: skillRows },
    { data: recentRounds },
    { data: functionRows },
    { data: usageRows },
  ] = await Promise.all([
    client.data
      .from("skill_scores")
      .select("bug_type, attempts, caught")
      .eq("user_id", user.id)
      .order("attempts", { ascending: false }),

    client.data
      .from("rounds")
      .select("id, size, status, repo_id, created_at, submitted_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),

    client.data
      .from("functions")
      .select("category, excluded, explained")
      .eq("user_id", user.id),

    client.data
      .from("usage")
      .select("day, rounds, ai_calls")
      .eq("user_id", user.id)
      .order("day", { ascending: false })
      .limit(7),
  ]);

  // ── Understanding scores ──────────────────────────────────────────────────
  const { data: scoreRows } = await client.data
    .from("understanding_scores")
    .select("score, updated_at")
    .eq("user_id", user.id)
    .order("score", { ascending: false });

  const avgScore =
    scoreRows && scoreRows.length > 0
      ? Math.round(
          scoreRows.reduce((s, r) => s + (r.score ?? 0), 0) / scoreRows.length,
        )
      : null;

  // ── Coverage by category ──────────────────────────────────────────────────
  const categories = ["entry", "core", "data", "helper"] as const;
  const coverage = categories.map((cat) => {
    const fns = (functionRows ?? []).filter(
      (f) => f.category === cat && !f.excluded,
    );
    const reviewed = fns.filter((f) => f.explained).length;
    return { cat, reviewed, eligible: fns.length };
  });

  // ── Round history with repo names ─────────────────────────────────────────
  const repoIds = [...new Set((recentRounds ?? []).map((r) => r.repo_id))];
  const { data: repoRows } = repoIds.length
    ? await client.data
        .from("repos")
        .select("id, owner, name")
        .in("id", repoIds)
    : { data: [] };
  const repoMap = new Map((repoRows ?? []).map((r) => [r.id, r]));

  // ── Streak (consecutive days with a round) ────────────────────────────────
  const daysWithRound = new Set(
    (recentRounds ?? [])
      .filter((r) => r.status === "completed")
      .map((r) => r.created_at?.slice(0, 10)),
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (daysWithRound.has(d.toISOString().slice(0, 10))) streak++;
    else break;
  }

  const scoreColor =
    (avgScore ?? 0) >= 80
      ? "text-emerald-500 border-emerald-500"
      : (avgScore ?? 0) >= 50
        ? "text-amber-500 border-amber-500"
        : "text-red-500 border-red-500";

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-lg font-bold tracking-tight hover:opacity-80"
            >
              CodeWiz
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-muted-foreground">
              Profile
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">← Dashboard</Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>

        {/* Top stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Overall score gauge */}
          <Card className="flex flex-col items-center justify-center p-4 text-center">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full border-4 font-mono text-xl font-bold ${avgScore !== null ? scoreColor : "border-muted text-muted-foreground"}`}
            >
              {avgScore !== null ? `${avgScore}%` : "—"}
            </div>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              Avg Score
            </p>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Rounds Done
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {(recentRounds ?? []).filter((r) => r.status === "completed")
                  .length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Functions Reviewed
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {scoreRows?.length ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Day Streak
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {streak}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  day{streak !== 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Skill Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Skill Profile</CardTitle>
            <CardDescription>
              Bug-catch rate by type. Low rates mean more of those bugs will
              appear in future rounds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!skillRows || skillRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Complete a practice round to see your bug-catching skill
                profile.
              </p>
            ) : (
              <div className="space-y-3">
                {skillRows.map((s) => {
                  const rate =
                    s.attempts === 0 ? 0 : Math.round((s.caught / s.attempts) * 100);
                  const barColor =
                    rate >= 80
                      ? "bg-emerald-500"
                      : rate >= 50
                        ? "bg-amber-500"
                        : "bg-red-500";
                  return (
                    <div key={s.bug_type}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {BUG_TYPE_LABELS[s.bug_type] ?? s.bug_type}
                        </span>
                        <span className="text-muted-foreground">
                          {s.caught}/{s.attempts} caught · {rate}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coverage by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Coverage</CardTitle>
            <CardDescription>
              How many functions you&apos;ve reviewed per category, across all
              repos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {coverage.map(({ cat, reviewed, eligible }) => {
                const pct =
                  eligible === 0 ? 0 : Math.round((reviewed / eligible) * 100);
                return (
                  <div key={cat} className="space-y-1 text-center">
                    <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-secondary font-mono text-base font-bold text-foreground">
                      {pct}%
                    </div>
                    <p className="text-xs font-semibold capitalize text-muted-foreground">
                      {cat}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reviewed}/{eligible}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Round history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Round History</CardTitle>
            <CardDescription>Your last 10 practice rounds.</CardDescription>
          </CardHeader>
          <CardContent>
            {!recentRounds || recentRounds.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No rounds yet.{" "}
                <Link href="/dashboard" className="underline">
                  Go to the dashboard
                </Link>{" "}
                to start one.
              </p>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {recentRounds.map((r) => {
                  const repo = repoMap.get(r.repo_id);
                  return (
                    <div
                      key={r.id}
                      className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {repo
                              ? `${repo.owner}/${repo.name}`
                              : "Unknown repo"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              r.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                            }`}
                          >
                            {r.status}
                          </span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                            {r.size} functions
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Started {formatDate(r.created_at)}
                          {r.submitted_at &&
                            ` · Finished ${formatDate(r.submitted_at)}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {r.status === "completed" ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/rounds/${r.id}/results`}>
                              View Results
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm">
                            <Link href={`/rounds/${r.id}`}>Resume Round</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Key & Provider Settings (Bring Your Own Key) */}
        <AiKeySettings />

        {/* Usage this week */}
        {usageRows && usageRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Usage This Week</CardTitle>
              <CardDescription>
                Rounds and AI calls per day (last 7 days).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border rounded-md border text-sm">
                {usageRows.map((u) => (
                  <div
                    key={u.day}
                    className="flex items-center justify-between p-3"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {u.day}
                    </span>
                    <span>
                      {u.rounds} round{u.rounds !== 1 ? "s" : ""} ·{" "}
                      {u.ai_calls} AI call{u.ai_calls !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
