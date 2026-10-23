export type Flag = { line: number; comment: string };
export type AnswerKeyBug = { id: string; lineStart: number; lineEnd: number };

export type FlagMatch =
  | { flag: Flag; outcome: "caught"; bugId: string }
  | { flag: Flag; outcome: "unmatched" };

/** How far a flag may be from a planted line and still count as a catch. */
export const CATCH_TOLERANCE = 1;

/**
 * GRADE-1: a flag on a planted line, or one line either side, catches that
 * bug. When a flag is near two bugs it goes to the closer one. Pure code.
 */
export function matchFlags(flags: readonly Flag[], bugs: readonly AnswerKeyBug[]): FlagMatch[] {
  return flags.map((flag) => {
    let best: { id: string; distance: number } | null = null;
    for (const bug of bugs) {
      const distance =
        flag.line < bug.lineStart ? bug.lineStart - flag.line : flag.line > bug.lineEnd ? flag.line - bug.lineEnd : 0;
      if (distance <= CATCH_TOLERANCE && (!best || distance < best.distance)) {
        best = { id: bug.id, distance };
      }
    }
    return best ? { flag, outcome: "caught", bugId: best.id } : { flag, outcome: "unmatched" };
  });
}

/** IDs of the bugs caught by at least one flag. */
export function caughtBugIds(matches: readonly FlagMatch[]): Set<string> {
  return new Set(matches.flatMap((m) => (m.outcome === "caught" ? [m.bugId] : [])));
}
