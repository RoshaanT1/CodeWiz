"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageTitle } from "@/components/app-shell/page-parts";
import { DrillPanel } from "@/components/drill/drill-panel";
import { QuizPanel } from "@/components/quiz/quiz-panel";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client/post-json";
import type { LiveRoundData } from "@/lib/quiz/load-round";

/** ROUND-4: quiz, explanation, then drill for each function; resumes where the user left off. */
export function LiveRound({ round }: { round: LiveRoundData }) {
  const router = useRouter();
  const [progress, setProgress] = useState(() => round.functions.map((f) => ({ quizDone: f.quizDone, drillDone: f.drillDone })));
  const firstOpen = progress.findIndex((p) => !p.quizDone || !p.drillDone);
  const [index, setIndex] = useState(firstOpen === -1 ? Math.max(0, round.functions.length - 1) : firstOpen);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const fn = round.functions[index];
  const state = progress[index];
  const allDone = progress.every((p) => p.quizDone && p.drillDone);
  const doneCount = progress.filter((p) => p.quizDone && p.drillDone).length;

  function mark(key: "quizDone" | "drillDone") {
    setProgress((old) => old.map((p, i) => (i === index ? { ...p, [key]: true } : p)));
  }

  async function finish() {
    setFinishing(true);
    setFinishError(null);
    const res = await postJson<{ roundId: string }>(`/api/rounds/${round.id}/complete`);
    if (!res.ok) {
      setFinishing(false);
      setFinishError(res.message);
      return;
    }
    router.push(`/results/${round.id}`);
  }

  if (!fn || !state) {
    return <p className="py-16 text-center text-sm text-muted-foreground">This round has no functions. Start a new round from your repo page.</p>;
  }

  return (
    <div className="mx-auto max-w-[1080px] fade-in">
      <PageTitle
        eyebrow={`${round.repo} · function ${index + 1} of ${round.functions.length}`}
        title={fn.name}
        description={fn.reason ?? fn.file}
      />
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${doneCount} of ${round.functions.length} functions done`}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(doneCount / round.functions.length) * 100}%` }} />
      </div>
      <p className="mb-4 font-mono text-[11px] text-muted-foreground">{fn.file}</p>

      {!state.quizDone ? (
        <QuizPanel key={`quiz-${fn.roundFunctionId}`} roundFunctionId={fn.roundFunctionId} onDone={() => mark("quizDone")} />
      ) : (
        <DrillPanel key={`drill-${fn.roundFunctionId}`} roundFunctionId={fn.roundFunctionId} onDone={() => mark("drillDone")} />
      )}

      {state.quizDone && state.drillDone && (
        <div className="mt-6 flex flex-col items-start gap-2 border-t pt-5">
          {index < round.functions.length - 1 ? (
            <Button onClick={() => setIndex(index + 1)} data-testid="button-next-function">
              Next function <ArrowRight size={14} />
            </Button>
          ) : allDone ? (
            <Button onClick={() => void finish()} disabled={finishing} data-testid="button-finish-round">
              {finishing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Scoring your round…
                </>
              ) : (
                <>
                  Finish round and see results <ArrowRight size={14} />
                </>
              )}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setIndex(progress.findIndex((p) => !p.quizDone || !p.drillDone))}>
              Back to the unfinished function
            </Button>
          )}
          {finishError && (
            <p className="text-xs text-destructive" role="alert">
              {finishError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
