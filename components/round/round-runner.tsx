"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type RoundFunctionData = {
  id: string; // round_function_id
  functionId: string;
  position: number;
  selectionReason: string | null;
  name: string;
  qualifiedName: string | null;
  filePath: string;
  language: string;
  startLine: number;
  code: string;
  explanation: string | null;
};

export type RoundRunnerProps = {
  round: {
    id: string;
    size: number;
    status: string;
    repoId: string;
  };
  functions: RoundFunctionData[];
};

type QuizQuestion = {
  id: string;
  kind: string;
  question: string;
  answer?: string;
  score?: number | null;
  feedback?: string | null;
};

type DrillFlag = {
  line: number;
  comment: string;
};

type DrillFindingResult = {
  line: number;
  comment: string;
  outcome: "caught" | "false_alarm";
  explanationScore?: number | null;
};

type PlantedBugReveal = {
  id: string;
  line_start: number;
  line_end: number;
  bug_type: string;
  explanation: string;
  fix: string;
};

export function RoundRunner({ round, functions }: RoundRunnerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<"quiz" | "drill">("quiz");

  const currentFn = functions[currentIndex];

  // Quiz state
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [submittingAnswerId, setSubmittingAnswerId] = useState<string | null>(null);
  const [functionExplanation, setFunctionExplanation] = useState<string | null>(null);

  // Drill state
  const [loadingDrill, setLoadingDrill] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [drillId, setDrillId] = useState<string | null>(null);
  const [changedCode, setChangedCode] = useState<string>("");
  const [flags, setFlags] = useState<DrillFlag[]>([]);
  const [activeFlagLine, setActiveFlagLine] = useState<number | null>(null);
  const [flagCommentInput, setFlagCommentInput] = useState("");
  const [drillSubmitted, setDrillSubmitted] = useState(false);
  const [submittingDrill, setSubmittingDrill] = useState(false);
  const [drillFindings, setDrillFindings] = useState<DrillFindingResult[]>([]);
  const [revealedBugs, setRevealedBugs] = useState<PlantedBugReveal[]>([]);

  // Round completing
  const [completingRound, setCompletingRound] = useState(false);

  // Fetch or generate Quiz when current function changes
  useEffect(() => {
    if (!currentFn) return;
    setStep("quiz");
    setQuestions([]);
    setUserAnswers({});
    setFunctionExplanation(currentFn.explanation);
    setDrillSubmitted(false);
    setFlags([]);
    setDrillFindings([]);
    setRevealedBugs([]);
    setActiveFlagLine(null);

    async function loadQuiz() {
      setLoadingQuiz(true);
      setQuizError(null);
      try {
        const res = await fetch(`/api/round-functions/${currentFn.id}/quiz`, {
          method: "POST",
        });
        const json = await res.json();
        if (json.ok && json.data.questions) {
          setQuestions(json.data.questions);
        } else {
          setQuizError(json.error?.message ?? "Could not generate quiz questions.");
        }
      } catch {
        setQuizError("Network error loading quiz questions.");
      } finally {
        setLoadingQuiz(false);
      }
    }

    loadQuiz();
  }, [currentIndex, currentFn]);

  // Load or generate Drill when switching to drill step
  async function startDrillStep() {
    setStep("drill");
    if (changedCode && drillId) return; // already loaded for this function

    setLoadingDrill(true);
    setDrillError(null);
    try {
      const res = await fetch(`/api/round-functions/${currentFn.id}/drill`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setDrillId(json.data.id);
        setChangedCode(json.data.changedCode);
      } else {
        setDrillError(json.error?.message ?? "Could not generate bug drill.");
      }
    } catch {
      setDrillError("Network error loading drill code.");
    } finally {
      setLoadingDrill(false);
    }
  }

  // Submit single quiz item answer
  async function handleSubmitAnswer(itemId: string) {
    const answer = (userAnswers[itemId] ?? "").trim();
    setSubmittingAnswerId(itemId);
    try {
      const res = await fetch(`/api/quiz-items/${itemId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const json = await res.json();
      if (json.ok) {
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === itemId
              ? { ...q, answer, score: json.data.score, feedback: json.data.feedback }
              : q,
          ),
        );
      }
    } catch {
      // Keep state on failure
    } finally {
      setSubmittingAnswerId(null);
    }
  }

  // Handle drill flag creation
  function handleAddFlag() {
    if (activeFlagLine === null) return;
    const comment = flagCommentInput.trim();
    if (!comment) return;

    setFlags((prev) => [
      ...prev.filter((f) => f.line !== activeFlagLine),
      { line: activeFlagLine, comment },
    ]);
    setActiveFlagLine(null);
    setFlagCommentInput("");
  }

  function handleRemoveFlag(line: number) {
    setFlags((prev) => prev.filter((f) => f.line !== line));
  }

  // Submit drill
  async function handleSubmitDrill() {
    if (!drillId) return;
    setSubmittingDrill(true);
    setDrillError(null);
    try {
      const res = await fetch(`/api/drills/${drillId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setDrillSubmitted(true);
        setDrillFindings(json.data.findings ?? []);
        setRevealedBugs(json.data.plantedBugs ?? []);
      } else {
        setDrillError(json.error?.message ?? "Failed to submit drill.");
      }
    } catch {
      setDrillError("Network error submitting drill.");
    } finally {
      setSubmittingDrill(false);
    }
  }

  // Complete round or next function
  async function handleNextOrComplete() {
    if (currentIndex < functions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Last function finished -> complete round
      setCompletingRound(true);
      try {
        const res = await fetch(`/api/rounds/${round.id}/complete`, {
          method: "POST",
        });
        const json = await res.json();
        if (json.ok) {
          router.push(`/rounds/${round.id}/results`);
        } else {
          router.push(`/rounds/${round.id}/results`);
        }
      } catch {
        router.push(`/rounds/${round.id}/results`);
      }
    }
  }

  const allQuestionsAnswered =
    questions.length > 0 && questions.every((q) => q.score !== undefined && q.score !== null);

  const progressPercent = Math.round(
    ((currentIndex + (step === "drill" ? (drillSubmitted ? 1 : 0.5) : 0)) / functions.length) * 100,
  );

  return (
    <div className="space-y-6">
      {/* Round Header & Progress Bar */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Round Progress · Function {currentIndex + 1} of {functions.length}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {currentFn.qualifiedName || currentFn.name}
              </h2>
              <p className="font-mono text-xs text-muted-foreground">
                {currentFn.filePath}:{currentFn.startLine}
              </p>
            </div>

            {/* Step Selector Tabs */}
            <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setStep("quiz")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  step === "quiz"
                    ? "bg-background font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                1. Function Quiz {allQuestionsAnswered && "✓"}
              </button>
              <button
                type="button"
                onClick={startDrillStep}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  step === "drill"
                    ? "bg-background font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                2. Spot-the-Bug Drill {drillSubmitted && "✓"}
              </button>
            </div>
          </div>

          {/* Progress bar line */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* STEP 1: QUIZ */}
      {step === "quiz" && (
        <div className="space-y-6">
          {loadingQuiz && (
            <Card>
              <CardContent className="p-12 text-center text-sm text-muted-foreground animate-pulse">
                Generating tailored quiz questions with AI…
              </CardContent>
            </Card>
          )}

          {quizError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {quizError}
            </div>
          )}

          {!loadingQuiz && questions.length > 0 && (
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const isAnswered = q.score !== undefined && q.score !== null;
                const answerText = userAnswers[q.id] ?? q.answer ?? "";

                return (
                  <Card key={q.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Question {idx + 1} ({q.kind})
                        </span>
                        {isAnswered && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              q.score === 2
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : q.score === 1
                                  ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                            }`}
                          >
                            Score: {q.score} / 2
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base font-medium">{q.question}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!isAnswered ? (
                        <>
                          <textarea
                            rows={3}
                            placeholder="Explain in your own words what happens..."
                            value={answerText}
                            onChange={(e) =>
                              setUserAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              disabled={submittingAnswerId === q.id || !answerText.trim()}
                              onClick={() => handleSubmitAnswer(q.id)}
                            >
                              {submittingAnswerId === q.id ? "Grading..." : "Submit Answer"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
                          <div>
                            <span className="font-semibold text-muted-foreground">Your answer:</span>{" "}
                            <span className="italic">{q.answer}</span>
                          </div>
                          {q.feedback && (
                            <div className="text-foreground">
                              <span className="font-semibold">Feedback:</span> {q.feedback}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Reveal explanation once answers are submitted */}
              {allQuestionsAnswered && (
                <Card className="border-primary/40 bg-primary/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Function Explanation</CardTitle>
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Model Answer (AI)
                      </span>
                    </div>
                    <CardDescription>
                      Plain-language model explanation of how this function works.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-relaxed text-foreground">
                      {functionExplanation || "This function performs core operational logic for the module."}
                    </p>

                    <div className="flex justify-end pt-2">
                      <Button onClick={startDrillStep}>Proceed to Spot-the-Bug Drill →</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: SPOT-THE-BUG DRILL */}
      {step === "drill" && (
        <div className="space-y-6">
          {loadingDrill && (
            <Card>
              <CardContent className="p-12 text-center text-sm text-muted-foreground animate-pulse">
                Planting and verifying realistic bugs in the code…
              </CardContent>
            </Card>
          )}

          {drillError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {drillError}
            </div>
          )}

          {!loadingDrill && changedCode && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Code viewer with clickable lines */}
              <div className="lg:col-span-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Click any line to place or view a bug flag.</span>
                  <span>{flags.length} flag(s) placed</span>
                </div>

                <div className="rounded-md bg-zinc-950 font-mono text-xs text-zinc-100 overflow-x-auto border border-zinc-800">
                  {changedCode.split("\n").map((lineContent, idx) => {
                    const lineNum = currentFn.startLine + idx;
                    const hasFlag = flags.some((f) => f.line === lineNum);
                    const isActive = activeFlagLine === lineNum;

                    // After submission highlights
                    const caughtFinding = drillFindings.find(
                      (f) => f.line === lineNum && f.outcome === "caught",
                    );
                    const falseAlarmFinding = drillFindings.find(
                      (f) => f.line === lineNum && f.outcome === "false_alarm",
                    );
                    const isPlantedLine = revealedBugs.some(
                      (b) => lineNum >= b.line_start && lineNum <= b.line_end,
                    );

                    let bgClass = "hover:bg-zinc-800/60";
                    if (drillSubmitted) {
                      if (caughtFinding) bgClass = "bg-emerald-950/80 border-l-4 border-emerald-500";
                      else if (falseAlarmFinding) bgClass = "bg-yellow-950/80 border-l-4 border-yellow-500";
                      else if (isPlantedLine) bgClass = "bg-red-950/80 border-l-4 border-red-500";
                    } else if (hasFlag) {
                      bgClass = "bg-amber-950/70 border-l-4 border-amber-500";
                    } else if (isActive) {
                      bgClass = "bg-zinc-800 border-l-4 border-primary";
                    }

                    return (
                      <div
                        key={lineNum}
                        onClick={() => {
                          if (!drillSubmitted) {
                            setActiveFlagLine(lineNum);
                            const existing = flags.find((f) => f.line === lineNum);
                            setFlagCommentInput(existing ? existing.comment : "");
                          }
                        }}
                        className={`group flex items-center px-3 py-1 cursor-pointer transition-colors ${bgClass}`}
                      >
                        <span className="w-10 select-none text-right pr-4 text-zinc-500 group-hover:text-zinc-300">
                          {lineNum}
                        </span>
                        <span className="flex-1 whitespace-pre">
                          {lineContent || " "}
                        </span>
                        {hasFlag && (
                          <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400 font-sans">
                            Flagged
                          </span>
                        )}
                        {drillSubmitted && caughtFinding && (
                          <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400 font-sans">
                            Caught!
                          </span>
                        )}
                        {drillSubmitted && isPlantedLine && !caughtFinding && (
                          <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400 font-sans">
                            Missed Bug
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar: Flag Editor & Controls */}
              <div className="space-y-4">
                {/* Active line flag input */}
                {!drillSubmitted && activeFlagLine !== null && (
                  <Card className="border-primary/50 shadow-md">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm">Flag Line {activeFlagLine}</CardTitle>
                      <CardDescription className="text-xs">
                        Explain why you think this line contains a bug.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-2">
                      <Input
                        placeholder="e.g., Loop condition should be < not <="
                        value={flagCommentInput}
                        onChange={(e) => setFlagCommentInput(e.target.value)}
                        className="text-xs"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveFlagLine(null)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={!flagCommentInput.trim()}
                          onClick={handleAddFlag}
                          className="h-7 text-xs"
                        >
                          Save Flag
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Flags summary card */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Your Flags ({flags.length})</CardTitle>
                    <CardDescription className="text-xs">
                      Flagged lines will be graded against the planted bugs.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-2">
                    {flags.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No lines flagged yet. Click a line number to flag a bug.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {flags.map((f) => (
                          <div
                            key={f.line}
                            className="flex items-start justify-between rounded bg-muted/60 p-2 text-xs"
                          >
                            <div>
                              <span className="font-mono font-bold">Line {f.line}:</span>{" "}
                              <span>{f.comment}</span>
                            </div>
                            {!drillSubmitted && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFlag(f.line)}
                                className="ml-2 text-destructive hover:underline"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!drillSubmitted && (
                      <div className="pt-2">
                        <Button
                          className="w-full"
                          disabled={submittingDrill}
                          onClick={handleSubmitDrill}
                        >
                          {submittingDrill ? "Grading Flags..." : "Submit Drill"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Drill Results / Answer Key (Visible after submit) */}
                {drillSubmitted && (
                  <Card className="border-emerald-500/40 bg-emerald-500/5">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm">Answer Key & Results</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-3">
                      {revealedBugs.map((bug, i) => (
                        <div key={bug.id} className="rounded border bg-background p-3 text-xs space-y-1">
                          <div className="font-bold text-foreground">
                            Bug {i + 1}: {bug.bug_type} (Lines {bug.line_start}-{bug.line_end})
                          </div>
                          <div className="text-muted-foreground">
                            <span className="font-semibold">Explanation:</span> {bug.explanation}
                          </div>
                          <div className="text-emerald-600 dark:text-emerald-400">
                            <span className="font-semibold">Fix:</span> {bug.fix}
                          </div>
                        </div>
                      ))}

                      <div className="pt-2">
                        <Button
                          className="w-full"
                          disabled={completingRound}
                          onClick={handleNextOrComplete}
                        >
                          {completingRound
                            ? "Finalizing Scores…"
                            : currentIndex < functions.length - 1
                              ? "Next Function →"
                              : "Finish Round & View Results →"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
