export type SkillTally = { bugType: string; attempts: number; caught: number };

/**
 * SCORE-2: adds one drill's bugs to the per-type tallies. Every planted bug
 * is one attempt at its type, and a catch if any flag matched it.
 */
export function addDrillToSkills(
  existing: readonly SkillTally[],
  bugs: readonly { id: string; bugType: string }[],
  caughtIds: ReadonlySet<string>,
): SkillTally[] {
  const tallies = new Map(existing.map((row) => [row.bugType, { ...row }]));
  for (const bug of bugs) {
    const row = tallies.get(bug.bugType) ?? { bugType: bug.bugType, attempts: 0, caught: 0 };
    row.attempts += 1;
    if (caughtIds.has(bug.id)) row.caught += 1;
    tallies.set(bug.bugType, row);
  }
  const touched = new Set(bugs.map((b) => b.bugType));
  return [...tallies.values()].filter((row) => touched.has(row.bugType));
}

/** Catch rate per bug type, 0 to 1. Types with no attempts are left out. */
export function catchRates(rows: readonly SkillTally[]): { bugType: string; rate: number; attempts: number }[] {
  return rows
    .filter((row) => row.attempts > 0)
    .map((row) => ({ bugType: row.bugType, rate: row.caught / row.attempts, attempts: row.attempts }));
}
