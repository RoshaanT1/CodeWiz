"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type FunctionResultItem = {
  functionId: string;
  name: string;
  qualifiedName: string | null;
  filePath: string;
  category: string | null;
  score: number; // 0-100
  quizItems: {
    question: string;
    score: number | null;
    feedback: string | null;
  }[];
  drill: {
    caughtCount: number;
    totalPlanted: number;
    falseAlarms: number;
    plantedBugs: {
      bugType: string;
      lineStart: number;
      lineEnd: number;
      explanation: string;
      fix: string;
      caught: boolean;
    }[];
  } | null;
};

export type RoundResultsViewProps = {
  roundId: string;
  repo: {
    id: string;
    owner: string;
    name: string;
  };
  overallScore: number;
  totalQuizPoints: number;
  maxQuizPoints: number;
  totalCaught: number;
  totalPlanted: number;
  totalFalseAlarms: number;
  functionResults: FunctionResultItem[];
};

export function RoundResultsView({
  repo,
  overallScore,
  totalQuizPoints,
  maxQuizPoints,
  totalCaught,
  totalPlanted,
  totalFalseAlarms,
  functionResults,
}: RoundResultsViewProps) {
  const quizPercent =
    maxQuizPoints > 0 ? Math.round((totalQuizPoints / maxQuizPoints) * 100) : 0;
  const drillPercent =
    totalPlanted > 0 ? Math.round((totalCaught / totalPlanted) * 100) : 0;

  // Color for score gauge
  const scoreColor =
    overallScore >= 80
      ? "text-emerald-500 border-emerald-500"
      : overallScore >= 50
        ? "text-amber-500 border-amber-500"
        : "text-red-500 border-red-500";

  return (
    <div className="space-y-8">
      {/* Title & Navigation */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Round Results</h1>
          <p className="text-sm text-muted-foreground">
            Repo:{" "}
            <Link
              href={`/repos/${repo.id}`}
              className="font-medium text-foreground underline hover:opacity-80"
            >
              {repo.owner}/{repo.name}
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href={`/repos/${repo.id}`}>View Repo Map</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </div>

      {/* Main Score Gauge & Metrics Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Gauge card */}
        <Card className="flex flex-col items-center justify-center p-6 text-center">
          <div
            className={`flex h-32 w-32 items-center justify-center rounded-full border-8 font-mono text-3xl font-bold ${scoreColor}`}
          >
            {overallScore}%
          </div>
          <CardTitle className="mt-4 text-lg">Understanding Score</CardTitle>
          <CardDescription className="text-xs">
            Combined signal of your quiz accuracy and bug drill detection.
          </CardDescription>
        </Card>

        {/* Detailed Stats */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Quiz Accuracy
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {quizPercent}%
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {totalQuizPoints} / {maxQuizPoints} total points scored on function purpose & behaviour.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Bug Catch Rate
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {drillPercent}%
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {totalCaught} of {totalPlanted} realistic seeded bugs spotted.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                False Alarms
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-500">
                {totalFalseAlarms}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Flags placed on working code lines without bugs.
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                Functions Reviewed
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {functionResults.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Key functions added to your profile understanding index.
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Per-Function Review Breakdown */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Function Breakdown</h2>

        <div className="space-y-4">
          {functionResults.map((fn, idx) => (
            <Card key={fn.functionId} className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">
                        Function {idx + 1}
                      </span>
                      {fn.category && (
                        <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase">
                          {fn.category}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg font-mono">
                      {fn.qualifiedName || fn.name}
                    </CardTitle>
                    <p className="font-mono text-xs text-muted-foreground">
                      {fn.filePath}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Score:</span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-bold text-primary">
                      {fn.score}%
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Quiz items review */}
                {fn.quizItems.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Quiz Questions
                    </h3>
                    <div className="space-y-2">
                      {fn.quizItems.map((q, qIdx) => (
                        <div key={qIdx} className="rounded-md border p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between font-medium">
                            <span>{q.question}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-bold ${
                                q.score === 2
                                  ? "text-emerald-500 bg-emerald-500/10"
                                  : q.score === 1
                                    ? "text-yellow-500 bg-yellow-500/10"
                                    : "text-red-500 bg-red-500/10"
                              }`}
                            >
                              {q.score ?? 0} / 2 pts
                            </span>
                          </div>
                          {q.feedback && (
                            <p className="text-muted-foreground italic">
                              Feedback: {q.feedback}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bug Drill Review & Answer Key */}
                {fn.drill && fn.drill.plantedBugs.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Planted Bugs & Drills
                    </h3>
                    <div className="space-y-2">
                      {fn.drill.plantedBugs.map((bug, bIdx) => (
                        <div
                          key={bIdx}
                          className={`rounded-md border p-3 text-xs space-y-1.5 ${
                            bug.caught
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-red-500/40 bg-red-500/5"
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-foreground">
                              {bug.bugType} (Lines {bug.lineStart}-{bug.lineEnd})
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] ${
                                bug.caught
                                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                  : "bg-red-500/20 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {bug.caught ? "CAUGHT" : "MISSED"}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            <span className="font-semibold text-foreground">Explanation:</span>{" "}
                            {bug.explanation}
                          </p>
                          <p className="text-emerald-600 dark:text-emerald-400">
                            <span className="font-semibold">Fix:</span> {bug.fix}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
