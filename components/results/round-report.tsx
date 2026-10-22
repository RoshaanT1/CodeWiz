import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { EmptyState, PageTitle, SectionTitle } from "@/components/app-shell/page-parts";
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
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        {[
          ["Average understanding", average === null ? "Not scored yet" : `${average} / 100`],
          ["Functions", String(round.functions.length)],
          ["Bugs caught", planted ? `${caught} of ${planted}` : "No drills yet"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border bg-card p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-2 font-mono text-xl font-semibold text-primary">{value}</div>
          </div>
        ))}
      </div>

      {round.functions.length === 0 ? (
        <EmptyState title="No functions in this round" text="Start a new round from your dashboard." />
      ) : (
        <div className="space-y-8">
          {round.functions.map((fn) => (
            <section key={fn.roundFunctionId} data-testid={`result-function-${fn.functionId}`}>
              <SectionTitle
                aside={
                  <span className="font-mono text-sm font-semibold text-primary">
                    {fn.score === null ? "Not scored" : `${fn.score} / 100`}
                  </span>
                }
              >
                <span>{fn.name}</span>
                <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">{fn.file}</span>
              </SectionTitle>

              {fn.quiz.length > 0 && (
                <div className="mb-4 space-y-2">
                  {fn.quiz.map((q, i) => (
                    <div key={i} className="rounded-md border bg-card p-3 text-xs leading-5">
                      <div className="flex justify-between gap-3 font-medium">
                        <span>{q.question}</span>
                        {q.score !== null && <span className="shrink-0 font-mono">{q.score}/2</span>}
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground">Your answer:</span> {q.answer || "No answer"}
                      </p>
                      {q.feedback && (
                        <p className="mt-1 text-muted-foreground">
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
