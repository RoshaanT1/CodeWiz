"use client";

import { ArrowLeft, Check, CircleAlert } from "lucide-react";
import Link from "next/link";

import { useWorkspace } from "@/components/app-shell/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function RoundResults({ roundId }: { roundId: string }) {
  const { rounds, repositories } = useWorkspace();
  const round = rounds.find((r) => r.id === roundId) ?? rounds[0];
  const repo = repositories.find((r) => r.id === round?.repoId);

  if (!round) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No results are available for this round.</div>;
  }

  const functions = round.functionIds
    .map((id) => repo?.functions.find((fn) => fn.id === id))
    .filter((fn): fn is NonNullable<typeof fn> => !!fn);
  const resultFor = (id: string) => round.functionResults?.find((result) => result.functionId === id);
  const score = round.functionResults?.length
    ? Math.round(round.functionResults.reduce((sum, r) => sum + r.understanding, 0) / round.functionResults.length)
    : round.score;
  const caught = round.functionResults?.reduce((sum, r) => sum + r.caught, 0) ?? round.bugsFound;

  return (
    <div className="mx-auto max-w-[1080px] fade-in">
      <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard">Dashboard</Link>
        <span>/</span>
        <Link href={`/repo/${round.repoId}`}>{round.repoName}</Link>
        <span>/</span>
        <span className="text-foreground">Results</span>
      </div>
      <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            Round {round.id} · {round.date}
          </div>
          <h1 className="text-2xl font-semibold">Round results</h1>
          <p className="mt-1 text-sm text-muted-foreground">A function-by-function record of your reasoning and findings.</p>
        </div>
        <Link href={`/repo/${round.repoId}`}>
          <Button variant="outline" data-testid="button-back-to-repo">
            <ArrowLeft size={14} />
            Back to repository
          </Button>
        </Link>
      </div>
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        {[
          ["Understanding score", `${score} / 100`],
          ["Bugs caught", String(caught)],
          ["Functions reviewed", String(round.functionIds.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border bg-card p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-2 font-mono text-2xl font-semibold text-primary">{value}</div>
          </div>
        ))}
      </div>
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">Function results</h2>
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Function</th>
                <th className="px-4 py-3 font-medium">Understanding</th>
                <th className="px-4 py-3 font-medium">Caught</th>
                <th className="px-4 py-3 font-medium">Missed</th>
                <th className="px-4 py-3 font-medium">False alarms</th>
              </tr>
            </thead>
            <tbody>
              {functions.map((fn) => {
                const result = resultFor(fn.id);
                return (
                  <tr key={fn.id} className="border-b last:border-0" data-testid={`result-function-${fn.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{fn.qualifiedName}</div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{fn.file}</div>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-primary">{result?.understanding ?? 0} / 100</td>
                    <td className="px-4 py-3 font-mono">{result?.caught ?? 0}</td>
                    <td className="px-4 py-3 font-mono">{result?.missed ?? 0}</td>
                    <td className="px-4 py-3 font-mono">{result?.falseAlarms ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">Planted bugs · original vs changed</h2>
        {round.bugs.length === 0 ? (
          <div className="rounded-md border p-5 text-sm text-muted-foreground">No planted bugs were assigned to this round.</div>
        ) : (
          <div className="space-y-3">
            {round.bugs.map((bug, i) => {
              const fn = functions.find((item) => item.id === bug.functionId);
              return (
                <article
                  key={`${bug.functionId}-${bug.lineStart}-${i}`}
                  className="overflow-hidden rounded-md border bg-card"
                  data-testid={`result-bug-${i}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                    <div className="text-sm font-medium">
                      {fn?.qualifiedName ?? "Function"}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        · {fn?.file ?? "unknown file"}:{bug.lineStart}
                      </span>
                    </div>
                    <Badge variant="secondary">{bug.bugType.replaceAll("_", " ")}</Badge>
                  </div>
                  <div className="grid md:grid-cols-2">
                    <div className="border-b p-4 md:border-b-0 md:border-r">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Original</div>
                      <pre className="whitespace-pre-wrap rounded bg-emerald-50 p-2 font-mono text-xs text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200">
                        {bug.originalLine}
                      </pre>
                    </div>
                    <div className="p-4">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Changed</div>
                      <pre className="whitespace-pre-wrap rounded bg-red-50 p-2 font-mono text-xs text-red-900 dark:bg-red-950/35 dark:text-red-200">
                        {bug.changedLine}
                      </pre>
                      <p className="mt-3 text-xs leading-5">
                        <strong>Explanation:</strong> {bug.explanation}
                      </p>
                      <p className="mt-2 rounded bg-muted p-2 text-xs leading-5">
                        <strong>Fix:</strong> {bug.fix}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">Your flags &amp; evidence</h2>
        {round.findings.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">No flags were recorded during this round.</div>
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            {round.findings.map((finding, i) => (
              <div
                key={`${finding.functionId}-${finding.line}-${i}`}
                className="flex gap-3 border-b p-4 last:border-0"
                data-testid={`result-finding-${i}`}
              >
                <span className="mt-0.5">
                  {finding.outcome === "caught" ? (
                    <Check size={16} className="text-emerald-600" />
                  ) : (
                    <CircleAlert size={16} className={finding.outcome === "false_alarm" ? "text-amber-600" : "text-primary"} />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {functions.find((fn) => fn.id === finding.functionId)?.qualifiedName ?? "Function"} · line {finding.line}{" "}
                    <Badge variant="outline" className="ml-2">
                      {finding.outcome ?? "possible_real_bug"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{finding.comment}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    <strong>Evidence:</strong> {finding.evidence ?? "No evidence recorded."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
