import { isBugType, type BugType } from "./catalogue";
import type { PlantBugsOutput } from "./schema";

export type PlantedBug = {
  lineStart: number;
  lineEnd: number;
  bugType: BugType;
  explanation: string;
  fix: string;
};

export type CheckPlantedOptions = {
  original: string;
  startLine: number;
  count: number;
  allowed: readonly BugType[];
  output: PlantBugsOutput;
};

export type CheckPlantedResult =
  | { ok: true; changedCode: string; bugs: PlantedBug[] }
  | { ok: false; issues: string[] };

/** Cheap text checks that a bug's type matches the lines it changes. */
function checkBugTypeFits(type: BugType, originalLines: readonly string[]): string | null {
  const text = originalLines.join("\n");
  if (type === "wrong_return" && !/\breturn\b/.test(text)) {
    return "wrong_return must change a return statement.";
  }
  if (type === "mutable_default" && !/\bNone\b/.test(text)) {
    return "mutable_default must change a None default argument.";
  }
  return null;
}

/**
 * Code checks for AI step D: bug count, catalogue types, line ranges inside
 * the function, no overlaps, same line count, and every changed line belongs
 * to a listed bug while every listed bug changes at least one line.
 */
export function checkPlantedBugs(options: CheckPlantedOptions): CheckPlantedResult {
  const { original, startLine, count, allowed, output } = options;
  const issues: string[] = [];
  const originalLines = original.split("\n");
  const changedLines = output.changed_code.split("\n");
  const endLine = startLine + originalLines.length - 1;

  if (output.bugs.length !== count) {
    issues.push(`Expected exactly ${count} bugs, got ${output.bugs.length}.`);
  }
  if (changedLines.length !== originalLines.length) {
    issues.push(
      `changed_code has ${changedLines.length} lines but the original has ${originalLines.length}. Change lines in place only.`,
    );
  }

  const allowedSet = new Set<string>(allowed);
  const bugs: PlantedBug[] = [];
  for (const [i, bug] of output.bugs.entries()) {
    const label = `Bug ${i + 1}`;
    if (!isBugType(bug.bug_type) || !allowedSet.has(bug.bug_type)) {
      issues.push(`${label}: bug_type "${bug.bug_type}" is not an allowed type.`);
      continue;
    }
    if (bug.line_start > bug.line_end) {
      issues.push(`${label}: line_start ${bug.line_start} is after line_end ${bug.line_end}.`);
      continue;
    }
    if (bug.line_start < startLine || bug.line_end > endLine) {
      issues.push(`${label}: lines ${bug.line_start}-${bug.line_end} are outside ${startLine}-${endLine}.`);
      continue;
    }
    const typeIssue = checkBugTypeFits(bug.bug_type, originalLines.slice(bug.line_start - startLine, bug.line_end - startLine + 1));
    if (typeIssue) {
      issues.push(`${label}: ${typeIssue}`);
      continue;
    }
    bugs.push({
      lineStart: bug.line_start,
      lineEnd: bug.line_end,
      bugType: bug.bug_type,
      explanation: bug.explanation,
      fix: bug.fix,
    });
  }

  const sorted = [...bugs].sort((a, b) => a.lineStart - b.lineStart);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].lineStart <= sorted[i - 1].lineEnd) {
      issues.push(`Bugs at lines ${sorted[i - 1].lineStart} and ${sorted[i].lineStart} overlap.`);
    }
  }

  // Line-by-line comparison is only meaningful when the line counts match.
  if (issues.length === 0) {
    const touched = new Set<number>();
    originalLines.forEach((line, idx) => {
      if (line !== changedLines[idx]) touched.add(startLine + idx);
    });
    if (touched.size === 0) issues.push("changed_code is identical to the original.");
    for (const line of touched) {
      if (!bugs.some((b) => line >= b.lineStart && line <= b.lineEnd)) {
        issues.push(`Line ${line} was changed but is not listed in any bug.`);
      }
    }
    for (const bug of bugs) {
      let changed = false;
      for (let line = bug.lineStart; line <= bug.lineEnd; line++) {
        if (touched.has(line)) changed = true;
      }
      if (!changed) issues.push(`Bug at lines ${bug.lineStart}-${bug.lineEnd} does not change any code.`);
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, changedCode: output.changed_code, bugs };
}
