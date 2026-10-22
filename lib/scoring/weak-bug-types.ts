export type SkillRow = { bug_type: string; attempts: number; caught: number };

/**
 * Bug types to plant more of in the next drill: the ones with the lowest
 * catch rate, plus types never attempted yet. Returns at most `limit` types.
 */
export function weakBugTypes(rows: readonly SkillRow[], allTypes: readonly string[], limit = 3): string[] {
  const rate = new Map<string, number>();
  for (const row of rows) {
    if (row.attempts > 0) rate.set(row.bug_type, row.caught / row.attempts);
  }
  if (rate.size === 0) return [];

  return [...allTypes]
    .map((type, index) => ({ type, index, rate: rate.get(type) ?? 0 }))
    .filter((entry) => entry.rate < 1)
    .sort((a, b) => a.rate - b.rate || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.type);
}
