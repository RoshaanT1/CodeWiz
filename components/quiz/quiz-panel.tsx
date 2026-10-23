"use client";

import { CheckCircle2, CircleX, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postJson, postOnce } from "@/lib/client/post-json";
import type { QuizItemView, QuizView } from "@/lib/quiz/quiz-view";

const KIND_LABEL = { purpose: "Purpose", behaviour: "Behaviour", edge_case: "Edge case", impact: "Impact" } as const;

type Mode = "choice" | "written";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "choice", label: "Multiple choice", hint: "Quicker, and easier when you're starting out: pick one of four answers." },
  { id: "written", label: "Written", hint: "Explain it in your own words. Harder, and builds deeper understanding." },
];

const MODE_KEY = "codewiz:quiz-mode";

function readMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === "written" ? "written" : "choice";
  } catch {
    return "choice";
  }
}

type Props = {
  roundFunctionId: string;
  /** Called when every question is answered and the explanation is shown. */
  onDone: () => void;
};

/** QUIZ-2 and QUIZ-3: answer each question (multiple choice or written), see the grade and a tip, then the explanation. */
export function QuizPanel({ roundFunctionId, onDone }: Props) {
  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("choice");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [missed, setMissed] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  useEffect(() => {
    setMode(readMode());
  }, []);

  function chooseMode(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // The choice just won't be remembered.
    }
  }

  const load = useCallback(async () => {
    setLoadError(null);
    setQuiz(null);
    const res = await postOnce<QuizView>(`/api/round-functions/${roundFunctionId}/quiz`);
    if (res.ok) setQuiz(res.data);
    else setLoadError(res.message);
  }, [roundFunctionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(item: QuizItemView) {
    const asChoice = mode === "choice" && item.options !== null;
    if (asChoice && picks[item.id] === undefined) return;
    setBusy(item.id);
    setAnswerError(null);
    const body = asChoice ? { choice: picks[item.id] } : { answer: drafts[item.id] ?? "" };
    const res = await postJson<QuizView & { missedPoints: string[] }>(`/api/quiz-items/${item.id}/answer`, body);
    setBusy(null);
    if (!res.ok) {
      setAnswerError(res.message);
      return;
    }
    setQuiz({ items: res.data.items, explanation: res.data.explanation });
    setMissed((old) => ({ ...old, [item.id]: res.data.missedPoints }));
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
  const anyChoices = quiz.items.some((item) => item.options !== null);
  const activeHint = MODES.find((m) => m.id === mode)?.hint;
  return (
    <div className="space-y-4" data-testid="quiz-panel">
      {anyChoices && nextOpen && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-md border bg-card p-1" role="radiogroup" aria-label="How do you want to answer?">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                title={m.hint}
                onClick={() => chooseMode(m.id)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${mode === m.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                data-testid={`quiz-mode-${m.id}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{activeHint}</p>
        </div>
      )}

      {quiz.items.map((item, i) => {
        const asChoice = mode === "choice" && item.options !== null;
        return (
          <div key={item.id} className="rounded-md border bg-card p-4" data-testid={`quiz-item-${i}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
              {item.score !== null && <span className="font-mono text-xs font-semibold text-primary">{item.score}/2</span>}
            </div>
            <p className="text-sm font-medium leading-6">{item.question}</p>

            {item.answer === null ? (
              <>
                {asChoice ? (
                  <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Choose an answer">
                    {item.options?.map((option, oi) => (
                      <button
                        key={oi}
                        type="button"
                        role="radio"
                        aria-checked={picks[item.id] === oi}
                        disabled={item.id !== nextOpen || busy !== null}
                        onClick={() => setPicks((old) => ({ ...old, [item.id]: oi }))}
                        className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors disabled:opacity-50 ${picks[item.id] === oi ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                        data-testid={`quiz-option-${i}-${oi}`}
                      >
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${picks[item.id] === oi ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        <span className="leading-5">{option}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={drafts[item.id] ?? ""}
                    onChange={(e) => setDrafts((old) => ({ ...old, [item.id]: e.target.value }))}
                    maxLength={3000}
                    disabled={item.id !== nextOpen || busy !== null}
                    placeholder="Answer in your own words"
                    className="mt-3 min-h-24 w-full rounded-md border bg-background p-3 text-sm disabled:opacity-50"
                    data-testid={`input-quiz-answer-${i}`}
                  />
                )}
                {item.id === nextOpen && (
                  <Button
                    className="mt-2"
                    onClick={() => void submit(item)}
                    disabled={busy !== null || (asChoice && picks[item.id] === undefined)}
                    data-testid={`button-quiz-submit-${i}`}
                  >
                    {busy === item.id ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> {asChoice ? "Checking…" : "Grading…"}
                      </>
                    ) : (
                      "Submit answer"
                    )}
                  </Button>
                )}
              </>
            ) : (
              <AnsweredItem item={item} missed={missed[item.id] ?? []} />
            )}
          </div>
        );
      })}

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

/** An answered question: the options with the right one marked (or the written answer), feedback and the tip. */
function AnsweredItem({ item, missed }: { item: QuizItemView; missed: string[] }) {
  const chosen = item.options?.findIndex((o) => o === item.answer) ?? -1;
  const wasChoice = item.options !== null && chosen >= 0;
  return (
    <div className="mt-3 space-y-2 text-xs leading-5">
      {wasChoice ? (
        <div className="grid gap-1.5">
          {item.options?.map((option, oi) => {
            const correct = oi === item.correctOption;
            const picked = oi === chosen;
            return (
              <div
                key={oi}
                className={`flex items-start gap-2 rounded border p-2 ${correct ? "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30" : picked ? "border-destructive/50 bg-red-50 dark:bg-red-950/30" : "opacity-60"}`}
              >
                {correct ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" /> : picked ? <CircleX size={14} className="mt-0.5 shrink-0 text-destructive" /> : <span className="w-3.5 shrink-0" />}
                <span>
                  {option}
                  {picked && <span className="ml-1 text-muted-foreground">(your answer)</span>}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded bg-muted p-2">{item.answer || <em>No answer</em>}</p>
      )}
      {item.feedback && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">{wasChoice ? "Why:" : "AI feedback:"}</span> {item.feedback}
        </p>
      )}
      {missed.length > 0 && !wasChoice && (
        <ul className="list-disc pl-5 text-muted-foreground">
          {missed.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      {item.recommendation && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-950/20" data-testid="quiz-recommendation">
          <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <p>
            <span className="font-medium">Industry practice · AI recommendation:</span> {item.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}
