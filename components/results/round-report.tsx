import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { EmptyState, PageTitle } from "@/components/app-shell/page-parts";
import { DrillResults } from "@/components/drill/drill-results";
import { Button } from "@/components/ui/button";
import type { RoundResultsData } from "@/lib/scoring/load-round-results";

/** SCORE-4: a completed round, function by function, from stored results. */
export function RoundReport({ round }: { round: RoundResultsData }) {
  const scored = round.functions.filter((f) => f.score !== null);
  const average = scored.length ? Math.round(scored.reduce((sum, f) => sum + (f.score ?? 0), 0) / scored.length) : null;
  const caught = round.functions.reduce((sum, f) => sum + (f.drill?.bugs.filter((b) => b.caught).length ?? 0), 0);
  const planted = round.functions.reduce((sum, f) => sum + (f.drill?.bugs.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1080px] fade-in">
      <PageTitle
        eyebrow={`${round.repo} · ${new Date(round.createdAt).toLocaleDateString()}`}
        title="Round results"
        description={round.status === "completed" ? "A function-by-function record of your answers and catches." : "This round isn't finished yet. Results so far are below."}
        action={
          <Link href="/profile">
            <Button variant="outline" data-testid="button-results-profile">
              Your profile <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />
      <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ["Average understanding", average === null ? "Not scored yet" : `${average} / 100`],
          ["Functions", String(round.functions.length)],
          ["Bugs caught", planted ? `${caught} of ${planted}` : "No drills yet"],
        ].map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col justify-between rounded-md border bg-card p-3 sm:p-4">
            <div className="text-[11px] leading-4 text-muted-foreground sm:text-xs">{label}</div>
            <div className="mt-2 font-mono text-base font-semibold text-primary sm:text-xl">{value}</div>
          </div>
        ))}
      </div>

      {round.functions.length === 0 ? (
        <EmptyState title="No functions in this round" text="Start a new round from your dashboard." />
      ) : (
        <div className="space-y-8">
          {round.functions.map((fn, i) => (
            <section key={fn.roundFunctionId} className={i ? "border-t pt-8" : ""} data-testid={`result-function-${fn.functionId}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold">{fn.name}</h2>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{fn.file}</p>
                </div>
                <span className="shrink-0 rounded-md bg-accent px-2 py-1 font-mono text-sm font-semibold text-primary">
                  {fn.score === null ? "Not scored" : `${fn.score} / 100`}
                </span>
              </div>

              {fn.quiz.length > 0 && (
                <div className="mb-4 space-y-2">
                  {fn.quiz.map((q, i) => (
                    <div key={i} className="rounded-md border bg-card p-3 text-xs leading-5">
                      <div className="flex justify-between gap-3 font-medium">
                        <span className="min-w-0 break-words">{q.question}</span>
                        {q.score !== null && <span className="shrink-0 font-mono">{q.score}/2</span>}
                      </div>
                      <p className="mt-1 break-words text-muted-foreground">
                        <span className="font-medium text-foreground">Your answer:</span> {q.answer || "No answer"}
                      </p>
                      {q.feedback && (
                        <p className="mt-1 break-words text-muted-foreground">
                          <span className="font-medium text-foreground">AI feedback:</span> {q.feedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {fn.drill ? (
                <DrillResults result={fn.drill} />
              ) : (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No drill was submitted for this function.</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
