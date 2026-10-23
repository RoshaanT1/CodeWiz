"use client";

import { CheckCircle2, CircleX, ListChecks, Lightbulb, Loader2, PenLine, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postJson, postOnce } from "@/lib/client/post-json";
import type { QuizItemView, QuizView } from "@/lib/quiz/quiz-view";

const KIND_LABEL = { purpose: "Purpose", behaviour: "Behaviour", edge_case: "Edge case", impact: "Impact" } as const;

type Mode = "choice" | "written";

const MODES: { id: Mode; label: string; tag: string; hint: string }[] = [
  { id: "choice", label: "Multiple choice", tag: "Easier · good for beginners", hint: "Pick one of four answers. Quicker, and you see why the right one is right." },
  { id: "written", label: "Written", tag: "Harder · deeper understanding", hint: "Explain it in your own words. The AI grades the meaning, not the wording." },
];

/** The last mode picked, used as the suggested one next time. */
const PREFERRED_KEY = "codewiz:quiz-mode";
/** The mode locked in for one function's quiz. */
const lockKey = (roundFunctionId: string) => `codewiz:quiz-mode:${roundFunctionId}`;

function readStored(key: string): Mode | null {
  try {
    const value = window.localStorage.getItem(key);
    return value === "choice" || value === "written" ? value : null;
  } catch {
    return null;
  }
}

function store(key: string, mode: Mode) {
  try {
    window.localStorage.setItem(key, mode);
  } catch {
    // The choice just won't be remembered.
  }
}

/** Questions already answered fix the mode, even if this browser forgot it. */
function inferMode(items: QuizItemView[]): Mode | null {
  const answered = items.find((item) => item.answer !== null && item.answer !== "");
  if (!answered) return null;
  return answered.options?.includes(answered.answer ?? "") ? "choice" : "written";
}

const MAX_QUESTIONS = 9;

type Props = {
  roundFunctionId: string;
  /** Called when every question is answered and the explanation is shown. */
  onDone: () => void;
};

/** QUIZ-2 and QUIZ-3: answer each question (multiple choice or written), see the grade and a tip, then the explanation. */
export function QuizPanel({ roundFunctionId, onDone }: Props) {
  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [preferred, setPreferred] = useState<Mode>("choice");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [addingMore, setAddingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [missed, setMissed] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  useEffect(() => {
    setPreferred(readStored(PREFERRED_KEY) ?? "choice");
  }, []);

  function chooseMode(next: Mode) {
    setMode(next);
    store(lockKey(roundFunctionId), next);
    store(PREFERRED_KEY, next);
  }

  /** Shows a quiz; the explanation stays up once seen, even while practice questions are open. */
  const show = useCallback((view: QuizView) => {
    setQuiz(view);
    if (view.explanation) setExplanation(view.explanation);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    setQuiz(null);
    const res = await postOnce<QuizView>(`/api/round-functions/${roundFunctionId}/quiz`);
    if (!res.ok) {
      setLoadError(res.message);
      return;
    }
    show(res.data);
    const hasChoices = res.data.items.some((item) => item.options !== null);
    setMode(hasChoices ? (inferMode(res.data.items) ?? readStored(lockKey(roundFunctionId))) : "written");
  }, [roundFunctionId, show]);

  async function addMore() {
    setAddingMore(true);
    setMoreError(null);
    const res = await postJson<QuizView>(`/api/round-functions/${roundFunctionId}/quiz/more`);
    setAddingMore(false);
    if (res.ok) show(res.data);
    else setMoreError(res.message);
  }

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
    show({ items: res.data.items, explanation: res.data.explanation });
    setMissed((old) => ({ ...old, [item.id]: res.data.missedPoints }));
  }

  if (loadError) {
    return (
      <div className="max-w-3xl rounded-md border border-destructive/40 bg-card p-5 text-sm" role="alert">
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
      <div className="flex max-w-3xl items-center gap-3 rounded-md border bg-card p-5 text-sm text-muted-foreground" data-testid="quiz-loading">
        <Loader2 size={16} className="animate-spin" />
        Reading the function and writing questions about it…
      </div>
    );
  }

  const nextOpen = quiz.items.find((item) => item.answer === null)?.id;

  if (mode === null) {
    return (
      <div className="max-w-3xl rounded-md border bg-card p-4 sm:p-5" data-testid="quiz-mode-chooser">
        <h2 className="text-base font-semibold">How do you want to answer?</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {quiz.items.length} questions about this function. Your choice applies to the whole quiz.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How do you want to answer?">
          {MODES.map((m) => {
            const Icon = m.id === "choice" ? ListChecks : PenLine;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={preferred === m.id}
                onClick={() => chooseMode(m.id)}
                className={`flex flex-col items-start gap-1.5 rounded-md border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 ${preferred === m.id ? "border-primary/60" : ""}`}
                data-testid={`quiz-mode-${m.id}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon size={16} className="text-primary" /> {m.label}
                </span>
                <span className="text-[11px] font-medium text-primary">{m.tag}</span>
                <span className="text-xs leading-5 text-muted-foreground">{m.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const asked = quiz.items.length;
  return (
    <div className="max-w-3xl space-y-4" data-testid="quiz-panel">
      <p className="text-xs text-muted-foreground" data-testid="quiz-mode-label">
        Answering as <span className="font-medium text-foreground">{mode === "choice" ? "multiple choice" : "written answers"}</span>
      </p>

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
                    className="mt-3 w-full sm:w-auto"
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
      {explanation && (
        <div className="rounded-md border border-primary/30 bg-card p-4" data-testid="quiz-explanation">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Explanation · AI-generated</div>
          <p className="text-sm leading-6">{explanation}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={onDone} data-testid="button-quiz-continue">
              Continue to the bug drill
            </Button>
            {!nextOpen && asked < MAX_QUESTIONS && (
              <Button variant="outline" onClick={() => void addMore()} disabled={addingMore} data-testid="button-quiz-more">
                {addingMore ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Writing more questions…
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Practise with more questions
                  </>
                )}
              </Button>
            )}
          </div>
          {moreError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {moreError}
            </p>
          )}
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
