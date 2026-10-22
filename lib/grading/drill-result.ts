// The graded drill sent to the browser after submit. Shared by the submit
// route and the results components, so it imports nothing server-only.

export type FindingOutcome = "caught" | "false_alarm" | "possible_real_bug";

export type DrillResultBug = {
  lineStart: number;
  lineEnd: number;
  bugType: string;
  originalLines: string[];
  changedLines: string[];
  explanation: string;
  fix: string;
  caught: boolean;
};

export type DrillResultFinding = {
  line: number;
  comment: string;
  outcome: FindingOutcome;
  explanationScore: number | null;
  feedback: string | null;
};

export type DrillResult = {
  bugs: DrillResultBug[];
  findings: DrillResultFinding[];
};

export type BugRow = {
  id: string;
  line_start: number;
  line_end: number;
  bug_type: string;
  explanation: string;
  fix: string;
};

export type FindingRow = {
  line: number;
  comment: string;
  outcome: FindingOutcome;
  planted_bug_id: string | null;
  explanation_score: number | null;
  feedback: string | null;
};

/** Builds the browser view from stored rows, with each bug's original and changed lines. */
export function buildDrillResult(options: {
  bugs: readonly BugRow[];
  findings: readonly FindingRow[];
  originalCode: string;
  changedCode: string;
  startLine: number;
}): DrillResult {
  const original = options.originalCode.split("\n");
  const changed = options.changedCode.split("\n");
  const slice = (lines: string[], bug: BugRow) =>
    lines.slice(bug.line_start - options.startLine, bug.line_end - options.startLine + 1);
  const caught = new Set(options.findings.flatMap((f) => (f.outcome === "caught" && f.planted_bug_id ? [f.planted_bug_id] : [])));

  return {
    bugs: [...options.bugs]
      .sort((a, b) => a.line_start - b.line_start)
      .map((bug) => ({
        lineStart: bug.line_start,
        lineEnd: bug.line_end,
        bugType: bug.bug_type,
        originalLines: slice(original, bug),
        changedLines: slice(changed, bug),
        explanation: bug.explanation,
        fix: bug.fix,
        caught: caught.has(bug.id),
      })),
    findings: [...options.findings]
      .sort((a, b) => a.line - b.line)
      .map((f) => ({
        line: f.line,
        comment: f.comment,
        outcome: f.outcome,
        explanationScore: f.explanation_score,
        feedback: f.feedback,
      })),
  };
}
