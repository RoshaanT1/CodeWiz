"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client/post-json";
import type { QuizView } from "@/lib/quiz/quiz-view";

const KIND_LABEL = { purpose: "Purpose", behaviour: "Behaviour", edge_case: "Edge case", impact: "Impact" } as const;

type Props = {
  roundFunctionId: string;
  /** Called when every question is answered and the explanation is shown. */
  onDone: () => void;
};

/** QUIZ-2 and QUIZ-3: answer each question, see the grade, then the explanation. */
export function QuizPanel({ roundFunctionId, onDone }: Props) {
  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [missed, setMissed] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setQuiz(null);
    const res = await postJson<QuizView>(`/api/round-functions/${roundFunctionId}/quiz`);
    if (res.ok) setQuiz(res.data);
    else setLoadError(res.message);
  }, [roundFunctionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(itemId: string) {
    setBusy(itemId);
    setAnswerError(null);
    const res = await postJson<QuizView & { missedPoints: string[] }>(`/api/quiz-items/${itemId}/answer`, { answer: drafts[itemId] ?? "" });
    setBusy(null);
    if (!res.ok) {
      setAnswerError(res.message);
      return;
    }
    setQuiz({ items: res.data.items, explanation: res.data.explanation });
    setMissed((old) => ({ ...old, [itemId]: res.data.missedPoints }));
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-card p-5 text-sm" role="alert">
        <p className="font-medium">We couldn&apos;t load the questions.</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
          <RotateCcw size={14} /> Try again
        </Button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-card p-5 text-sm text-muted-foreground" data-testid="quiz-loading">
        <Loader2 size={16} className="animate-spin" />
        Reading the function and writing questions about it…
      </div>
    );
  }

  const nextOpen = quiz.items.find((item) => item.answer === null)?.id;
  return (
    <div className="space-y-4" data-testid="quiz-panel">
      {quiz.items.map((item, i) => (
        <div key={item.id} className="rounded-md border bg-card p-4" data-testid={`quiz-item-${i}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
            {item.score !== null && <span className="font-mono text-xs font-semibold text-primary">{item.score}/2</span>}
          </div>
          <p className="text-sm font-medium leading-6">{item.question}</p>
          {item.answer === null ? (
            <>
              <textarea
                value={drafts[item.id] ?? ""}
                onChange={(e) => setDrafts((old) => ({ ...old, [item.id]: e.target.value }))}
                maxLength={3000}
                disabled={item.id !== nextOpen || busy !== null}
                placeholder="Answer in your own words"
                className="mt-3 min-h-24 w-full rounded-md border bg-background p-3 text-sm disabled:opacity-50"
                data-testid={`input-quiz-answer-${i}`}
              />
              {item.id === nextOpen && (
                <Button className="mt-2" onClick={() => void submit(item.id)} disabled={busy !== null} data-testid={`button-quiz-submit-${i}`}>
                  {busy === item.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Grading…
                    </>
                  ) : (
                    "Submit answer"
                  )}
                </Button>
              )}
            </>
          ) : (
            <div className="mt-3 space-y-2 text-xs leading-5">
              <p className="rounded bg-muted p-2">{item.answer || <em>No answer</em>}</p>
              {item.feedback && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">AI feedback:</span> {item.feedback}
                </p>
              )}
              {(missed[item.id]?.length ?? 0) > 0 && (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {missed[item.id]?.map((point) => <li key={point}>{point}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
      {answerError && (
        <p className="text-xs text-destructive" role="alert">
          {answerError}
        </p>
      )}
      {quiz.explanation && (
        <div className="rounded-md border border-primary/30 bg-card p-4" data-testid="quiz-explanation">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Explanation · AI-generated</div>
          <p className="text-sm leading-6">{quiz.explanation}</p>
          <Button className="mt-3" onClick={onDone} data-testid="button-quiz-continue">
            Continue to the bug drill
          </Button>
        </div>
      )}
    </div>
  );
}
