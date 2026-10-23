import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DrillResult, FindingOutcome } from "@/lib/grading/drill-result";

import { BugTutor } from "./bug-tutor";

const OUTCOME: Record<FindingOutcome, { label: string; className: string }> = {
  caught: { label: "Caught", className: "text-emerald-700 dark:text-emerald-300" },
  false_alarm: { label: "False alarm", className: "text-muted-foreground" },
  possible_real_bug: { label: "Possible real bug", className: "text-amber-700 dark:text-amber-300" },
};

/** GRADE-4: each planted bug next to its original, plus how each flag was graded. With a drill id, each bug offers the tutor. */
export function DrillResults({ result, drillId }: { result: DrillResult; drillId?: string }) {
  const caught = result.bugs.filter((b) => b.caught).length;
  return (
    <div className="space-y-6" data-testid="drill-results">
      <p className="text-sm">
        You caught <strong>{caught}</strong> of <strong>{result.bugs.length}</strong> planted bug
        {result.bugs.length === 1 ? "" : "s"}.
      </p>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Planted bugs · original vs changed</h3>
        {result.bugs.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            This drill had no planted bugs.
          </div>
        ) : (
          <div className="space-y-3">
            {result.bugs.map((bug) => (
              <article key={bug.lineStart} className="overflow-hidden rounded-md border bg-card" data-testid={`drill-bug-${bug.lineStart}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {bug.caught ? (
                      <CheckCircle2 size={15} className="text-emerald-600" aria-label="Caught" />
                    ) : (
                      <CircleX size={15} className="text-destructive" aria-label="Missed" />
                    )}
                    {bug.caught ? "Caught" : "Missed"}
                    <span className="font-mono text-xs text-muted-foreground">
                      · line {bug.lineStart}
                      {bug.lineEnd !== bug.lineStart ? `–${bug.lineEnd}` : ""}
                    </span>
                  </div>
                  <Badge variant="secondary">{bug.bugType.replaceAll("_", " ")}</Badge>
                </div>
                <div className="grid md:grid-cols-2">
                  <div className="border-b p-4 md:border-b-0 md:border-r">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Original</div>
                    <pre className="overflow-x-auto rounded bg-emerald-50 p-2 font-mono text-xs text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200">
                      {bug.originalLines.join("\n")}
                    </pre>
                  </div>
                  <div className="p-4">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Changed</div>
                    <pre className="overflow-x-auto rounded bg-red-50 p-2 font-mono text-xs text-red-900 dark:bg-red-950/35 dark:text-red-200">
                      {bug.changedLines.join("\n")}
                    </pre>
                    <p className="mt-3 text-xs leading-5">
                      <strong>What it breaks:</strong> {bug.explanation}
                    </p>
                    <p className="mt-2 rounded bg-muted p-2 text-xs leading-5">
                      <strong>Fix:</strong> <code className="font-mono">{bug.fix}</code>
                    </p>
                  </div>
                </div>
                {drillId && (
                  <div className="border-t bg-muted/30 px-4 py-3">
                    <BugTutor drillId={drillId} lineStart={bug.lineStart} missed={!bug.caught} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Your flags</h3>
        {result.findings.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            You didn&apos;t flag any lines in this drill.
          </div>
        ) : (
          <div className="space-y-2">
            {result.findings.map((finding, i) => {
              const outcome = OUTCOME[finding.outcome];
              return (
                <div key={`${finding.line}-${i}`} className="rounded-md border bg-card p-3" data-testid={`drill-finding-${i}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                    <span>Line {finding.line}</span>
                    <span className={`flex items-center gap-1 ${outcome.className}`}>
                      {finding.outcome === "possible_real_bug" && <CircleAlert size={13} />}
                      {outcome.label}
                      {finding.explanationScore !== null && ` · explanation ${finding.explanationScore}/2`}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5">{finding.comment || <em className="text-muted-foreground">No comment</em>}</p>
                  {finding.feedback && (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      <span className="font-medium">AI feedback:</span> {finding.feedback}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
