"use client";

import { ArrowRight, CircleHelp, Flag, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useWorkspace } from "@/components/app-shell/workspace-provider";
import { CodeViewer } from "@/components/code-viewer";
import { ChangedCode } from "@/components/drill/changed-code";
import { SuggestionPanel } from "@/components/suggestions/suggestion-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Finding, Fn, Round, Suggestion } from "@/lib/demo/mock-data";

type Stage = "quiz" | "drill" | "suggestions";

const UNSURE = /possible|maybe|might/i;

function changedCode(fn: Fn, bugs: Round["bugs"]) {
  return fn.code
    .split("\n")
    .map((line, i) => {
      const bug = bugs.find((b) => b.functionId === fn.id && b.lineStart === fn.startLine + i);
      return bug ? bug.changedLine : line;
    })
    .join("\n");
}

// Demo scoring until QUIZ-2 and GRADE-1 land: answer length stands in for
// the rubric, and a flag counts as caught when it sits on a planted line.
function scoreAnswer(answer: string): { score: 0 | 1 | 2; feedback: string } {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 15) return { score: 2, feedback: "Clear explanation with enough detail to show the execution path." };
  if (words >= 5) return { score: 1, feedback: "A useful start; connect the inputs to the return value or side effect." };
  return { score: 0, feedback: "Add more detail about the steps or boundary behavior." };
}

function completeRound(round: Round): Round {
  const onBug = (f: Finding) =>
    round.bugs.find((b) => b.functionId === f.functionId && f.line >= b.lineStart && f.line <= b.lineEnd);
  const results = round.functionIds.map((id) => {
    const qs = round.questions.filter((q) => q.functionId === id);
    const understanding = Math.round(
      (qs.reduce((sum, q) => sum + (q.score ?? 0), 0) / Math.max(1, qs.length * 2)) * 100,
    );
    const bugs = round.bugs.filter((b) => b.functionId === id);
    const flags = round.findings.filter((f) => f.functionId === id);
    const hits = (f: Finding) => bugs.some((b) => f.line >= b.lineStart && f.line <= b.lineEnd);
    const caught = flags.filter(hits).length;
    const falseAlarms = flags.filter(
      (f) => f.outcome === "false_alarm" || (!hits(f) && !f.comment.toLowerCase().match(/possible|maybe|might/)),
    ).length;
    return { functionId: id, understanding, caught, missed: Math.max(0, bugs.length - caught), falseAlarms };
  });
  const findings = round.findings.map((f): Finding => {
    const bug = onBug(f);
    const possible = !bug && UNSURE.test(f.comment);
    return {
      ...f,
      outcome: bug ? "caught" : possible ? "possible_real_bug" : "false_alarm",
      evidence: bug
        ? bug.explanation
        : possible
          ? "Flagged for follow-up; no seeded bug was mapped to this line."
          : "No planted change corresponds to this line in this demo round.",
    };
  });
  const score = Math.round(results.reduce((sum, x) => sum + x.understanding, 0) / Math.max(1, results.length));
  return {
    ...round,
    status: "completed",
    functionResults: results,
    findings,
    score,
    bugsFound: results.reduce((sum, x) => sum + x.caught, 0),
  };
}

export function RoundWorkflow({ roundId }: { roundId: string }) {
  const router = useRouter();
  const { rounds, activeRound, repositories, setRounds, setCurrentRoundId } = useWorkspace();
  const round = rounds.find((r) => r.id === roundId) ?? activeRound;
  const [fnIndex, setFnIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("quiz");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answerScored, setAnswerScored] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const repo = repositories.find((r) => r.id === round?.repoId);
  const fn = repo?.functions.find((f) => f.id === round?.functionIds[fnIndex]);
  const functionQuestions = useMemo(
    () => round?.questions.filter((q) => q.functionId === fn?.id) ?? [],
    [round?.questions, fn?.id],
  );

  if (!round || !fn) {
    return (
      <div className="mx-auto max-w-2xl py-14 text-center">
        <h1 className="text-xl font-semibold">This round is unavailable</h1>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary">
          Return to dashboard
        </Link>
      </div>
    );
  }

  const findings = round.findings.filter((f) => f.functionId === fn.id);
  const suggestions = round.suggestions.filter((s) => s.functionId === fn.id);
  const progress =
    ((fnIndex + (stage === "quiz" ? 0 : stage === "drill" ? 0.34 : 0.68)) / Math.max(1, round.functionIds.length)) * 100;
  const update = (change: (r: Round) => Round) =>
    setRounds((prev) => prev.map((r) => (r.id === round.id ? change(r) : r)));

  if (round.status === "generating") {
    return (
      <div className="mx-auto max-w-2xl rounded-md border bg-card p-8 text-center" data-testid="status-round-generating">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary">
          <LoaderCircle size={18} className="animate-spin" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Preparing your round</h1>
        <p className="mt-2 text-sm text-muted-foreground">Selecting functions and setting up your practice workspace.</p>
        <Button
          className="mt-5"
          onClick={() => update((r) => ({ ...r, status: "in_progress" }))}
          data-testid="button-finish-generating"
        >
          Continue <ArrowRight size={14} />
        </Button>
      </div>
    );
  }

  function submitAnswer() {
    const q = functionQuestions[questionIndex];
    if (answerScored) {
      if (questionIndex < functionQuestions.length - 1) {
        setQuestionIndex(questionIndex + 1);
        setAnswer("");
        setAnswerScored(false);
      } else {
        setStage("drill");
      }
      return;
    }
    const { score, feedback } = scoreAnswer(answer);
    update((r) => ({
      ...r,
      questions: r.questions.map((item) => (item.id === q.id ? { ...item, response: answer, score, feedback } : item)),
    }));
    setAnswerScored(true);
  }

  function addFlag() {
    if (!fn) return;
    if (selectedLine === null) {
      setError("Select a line in the changed code.");
      return;
    }
    if (!comment.trim()) {
      setError("Add a short comment explaining the behavior.");
      return;
    }
    const finding: Finding = { line: selectedLine, comment: comment.trim(), functionId: fn.id };
    update((r) => ({ ...r, findings: [...r.findings, finding] }));
    setSelectedLine(null);
    setComment("");
    setError("");
  }

  function removeFlag(idx: number) {
    const target = findings[idx];
    update((r) => ({ ...r, findings: r.findings.filter((f) => f !== target) }));
  }

  function saveFlag(idx: number) {
    const target = findings[idx];
    update((r) => ({ ...r, findings: r.findings.map((f) => (f === target ? { ...f, comment: editText } : f)) }));
    setEditing(null);
  }

  function vote(suggestion: Suggestion, verdict: "agree" | "disagree") {
    update((r) => ({
      ...r,
      suggestions: r.suggestions.map((s) =>
        s.id === suggestion.id
          ? { ...s, verdict, reason: verdict === "disagree" ? (reason[s.id] ?? "") : undefined }
          : s,
      ),
    }));
  }

  function advanceFunction() {
    if (!round) return;
    if (fnIndex < round.functionIds.length - 1) {
      setFnIndex(fnIndex + 1);
      setStage("quiz");
      setQuestionIndex(0);
      setAnswer("");
      setSelectedLine(null);
      return;
    }
    update(completeRound);
    setCurrentRoundId(round.id);
    router.push(`/results/${round.id}`);
  }

  const current = functionQuestions[questionIndex];
  const isLastFunction = fnIndex === round.functionIds.length - 1;

  return (
    <div className="mx-auto max-w-[1120px] fade-in">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link href={`/repo/${round.repoId}`} className="hover:text-foreground">
          {round.repoName}
        </Link>
        <span>/</span>
        <span>Round {round.id}</span>
      </div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Function {fnIndex + 1} of {round.functionIds.length}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {stage === "quiz" ? "Understand the function" : stage === "drill" ? "Inspect the changed code" : "Review suggestions"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {fn.qualifiedName} <span className="font-mono text-xs">· {fn.file}</span>
          </p>
        </div>
        <div className="w-full sm:w-56">
          <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Round progress</span>
            <span className="font-mono">
              {fnIndex + 1} / {round.functionIds.length} functions
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <div className="mb-5 flex gap-1 border-b text-xs">
        {(["quiz", "drill", "suggestions"] as Stage[]).map((s) => (
          <div
            key={s}
            className={`border-b-2 px-3 pb-2 capitalize ${s === stage ? "border-primary font-medium" : "border-transparent text-muted-foreground"}`}
          >
            {s === "drill" ? "Drill" : s}
          </div>
        ))}
      </div>

      {stage === "quiz" && (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.8fr]">
          <section className="min-w-0">
            <CodeViewer fn={fn} selectedLines={[]} />
            <div className="mt-2 text-xs text-muted-foreground">
              Purpose · {fn.length} lines · {fn.branches} branches
            </div>
          </section>
          <section className="rounded-md border bg-card p-4" data-testid={`quiz-question-${current?.id}`}>
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <CircleHelp size={14} />
              QUESTION {questionIndex + 1} OF {functionQuestions.length}
            </div>
            <h2 className="mt-4 text-base font-semibold">{current?.question}</h2>
            <textarea
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setAnswerScored(false);
              }}
              className="mt-4 min-h-28 w-full rounded-md border bg-background p-3 text-sm"
              placeholder="Explain your reasoning…"
              data-testid="input-answer"
            />
            {answerScored && (
              <div className="mt-3 rounded-md border bg-muted/50 p-3" data-testid="answer-feedback">
                <div className="text-sm font-medium text-primary">Score {current?.score} / 2</div>
                <p className="mt-1 text-xs text-muted-foreground">{current?.feedback}</p>
              </div>
            )}
            <Button className="mt-4 w-full" disabled={!answer.trim()} onClick={submitAnswer} data-testid="button-submit-answer">
              {answerScored
                ? questionIndex === functionQuestions.length - 1
                  ? "Continue to drill"
                  : "Next question"
                : "Submit answer"}{" "}
              <ArrowRight size={14} />
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Free-text response · no timer</p>
          </section>
          {functionQuestions.every((q) => q.score !== undefined) && (
            <div className="rounded-md border bg-accent/30 p-4 lg:col-span-2" data-testid="ai-generated-explanation">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                AI-generated · plain-language explanation
              </div>
              <p className="text-sm leading-6">
                This function handles {fn.name} in {fn.file}. It accepts its arguments, follows the visible branches, and
                returns or updates the value used by its callers. Read each condition in order and check the boundary
                cases before moving on.
              </p>
            </div>
          )}
        </div>
      )}

      {stage === "drill" && (
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.75fr]">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Changed code · select suspicious lines</h2>
              <Badge variant="outline">
                <Flag size={12} className="mr-1" />
                {findings.length} flags
              </Badge>
            </div>
            <ChangedCode
              fn={fn}
              code={changedCode(fn, round.bugs)}
              selectedLine={selectedLine}
              flaggedLines={findings.map((f) => f.line)}
              onSelect={(line) => setSelectedLine((old) => (old === line ? null : line))}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Changed line copies are shown in red; select a line to comment.
            </p>
          </section>
          <aside className="space-y-3">
            <div className="rounded-md border bg-card p-4">
              <h3 className="text-sm font-semibold">Add a flag</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedLine === null ? "Select a line first" : `Line ${selectedLine} selected`}
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What could go wrong?"
                className="mt-3 min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                data-testid="input-finding-comment"
              />
              {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
              <Button className="mt-2 w-full" onClick={addFlag} data-testid="button-save-finding">
                Save flag
              </Button>
            </div>
            {findings.map((f, i) => (
              <div key={`${f.line}-${i}`} className="rounded-md border bg-card p-3" data-testid={`drill-flag-${i}`}>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Line {f.line}</span>
                  <span className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditing(i);
                        setEditText(f.comment);
                      }}
                      aria-label="Edit flag"
                      data-testid={`button-edit-flag-${i}`}
                    >
                      Edit
                    </button>
                    <button onClick={() => removeFlag(i)} aria-label="Remove flag" data-testid={`button-remove-flag-${i}`}>
                      <X size={13} />
                    </button>
                  </span>
                </div>
                {editing === i ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="mt-2 min-h-16 w-full rounded border bg-background p-2 text-xs"
                      data-testid={`input-edit-flag-${i}`}
                    />
                    <Button size="sm" className="mt-2" onClick={() => saveFlag(i)} data-testid={`button-save-flag-${i}`}>
                      Save comment
                    </Button>
                  </>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{f.comment}</p>
                )}
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setStage("suggestions")} data-testid="button-finish-drill">
              Continue to suggestions <ArrowRight size={14} />
            </Button>
          </aside>
        </div>
      )}

      {stage === "suggestions" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {suggestions.map((s) => (
              <SuggestionPanel
                key={s.id}
                suggestion={s}
                reason={reason[s.id] ?? s.reason ?? ""}
                onReason={(value) => {
                  setReason((prev) => ({ ...prev, [s.id]: value }));
                  update((r) => ({
                    ...r,
                    suggestions: r.suggestions.map((item) => (item.id === s.id ? { ...item, reason: value } : item)),
                  }));
                }}
                onVote={(v) => vote(s, v)}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={advanceFunction} data-testid="button-next-function">
              {isLastFunction ? "Finish round" : "Next function"} <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
