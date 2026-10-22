import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAal2User } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RoundResultsView, type FunctionResultItem } from "@/components/results/round-results-view";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Round Results · CodeWiz" };
export const dynamic = "force-dynamic";

export default async function RoundResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAal2User("/dashboard");
  const { id: roundId } = await params;

  const client = await createClient();
  const admin = createAdminClient();

  if (!client.ok || !admin.ok) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-destructive">Database connection error.</p>
      </div>
    );
  }

  // Load round.
  const { data: roundRow } = await client.data
    .from("rounds")
    .select("id, size, status, repo_id, created_at, submitted_at")
    .eq("id", roundId)
    .eq("user_id", user.id)
    .single();

  if (!roundRow) {
    notFound();
  }

  // Load repo.
  const { data: repoRow } = await client.data
    .from("repos")
    .select("id, owner, name")
    .eq("id", roundRow.repo_id)
    .single();

  // Load round_functions.
  const { data: rfRows } = await client.data
    .from("round_functions")
    .select("id, function_id, position")
    .eq("round_id", roundId)
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  const functionResults: FunctionResultItem[] = [];
  let totalQuizPoints = 0;
  let maxQuizPoints = 0;
  let totalCaught = 0;
  let totalPlanted = 0;
  let totalFalseAlarms = 0;
  let scoreSum = 0;

  for (const rf of rfRows ?? []) {
    // Function info.
    const { data: fn } = await client.data
      .from("functions")
      .select("id, name, qualified_name, file_path, category")
      .eq("id", rf.function_id)
      .single();

    // Understanding score.
    const { data: scoreRow } = await client.data
      .from("understanding_scores")
      .select("score")
      .eq("function_id", rf.function_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const fnScore = scoreRow?.score ?? 0;
    scoreSum += fnScore;

    // Quiz items.
    const { data: quizRows } = await client.data
      .from("quiz_items")
      .select("question, score, feedback")
      .eq("round_function_id", rf.id)
      .eq("user_id", user.id);

    const quizItems = (quizRows ?? []).map((q) => {
      const s = q.score ?? 0;
      totalQuizPoints += s;
      maxQuizPoints += 2;
      return {
        question: q.question ?? "",
        score: q.score,
        feedback: q.feedback,
      };
    });

    // Drill & planted bugs.
    const { data: drill } = await client.data
      .from("drills")
      .select("id")
      .eq("round_function_id", rf.id)
      .eq("user_id", user.id)
      .maybeSingle();

    let drillData: FunctionResultItem["drill"] = null;

    if (drill) {
      const { data: findings } = await client.data
        .from("findings")
        .select("outcome, planted_bug_id")
        .eq("drill_id", drill.id)
        .eq("user_id", user.id);

      const caughtIds = new Set(
        (findings ?? [])
          .filter((f) => f.outcome === "caught" && f.planted_bug_id)
          .map((f) => f.planted_bug_id as string),
      );

      const falseAlarmCount = (findings ?? []).filter(
        (f) => f.outcome === "false_alarm",
      ).length;
      totalFalseAlarms += falseAlarmCount;

      // Planted bugs via admin client.
      const { data: planted } = await admin.data
        .from("planted_bugs")
        .select("id, line_start, line_end, bug_type, explanation, fix")
        .eq("drill_id", drill.id);

      const plantedList = (planted ?? []).map((b) => {
        const isCaught = caughtIds.has(b.id);
        if (isCaught) totalCaught++;
        totalPlanted++;
        return {
          bugType: b.bug_type,
          lineStart: b.line_start,
          lineEnd: b.line_end,
          explanation: b.explanation,
          fix: b.fix,
          caught: isCaught,
        };
      });

      drillData = {
        caughtCount: caughtIds.size,
        totalPlanted: plantedList.length,
        falseAlarms: falseAlarmCount,
        plantedBugs: plantedList,
      };
    }

    functionResults.push({
      functionId: rf.function_id,
      name: fn?.name ?? "Function",
      qualifiedName: fn?.qualified_name ?? null,
      filePath: fn?.file_path ?? "",
      category: fn?.category ?? null,
      score: fnScore,
      quizItems,
      drill: drillData,
    });
  }

  const overallScore =
    functionResults.length > 0 ? Math.round(scoreSum / functionResults.length) : 0;

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-lg font-bold tracking-tight hover:opacity-80">
              CodeWiz
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-muted-foreground">Results</span>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <RoundResultsView
          roundId={roundId}
          repo={{
            id: roundRow.repo_id,
            owner: repoRow?.owner ?? "repo",
            name: repoRow?.name ?? "repo",
          }}
          overallScore={overallScore}
          totalQuizPoints={totalQuizPoints}
          maxQuizPoints={maxQuizPoints}
          totalCaught={totalCaught}
          totalPlanted={totalPlanted}
          totalFalseAlarms={totalFalseAlarms}
          functionResults={functionResults}
        />
      </main>
    </div>
  );
}
