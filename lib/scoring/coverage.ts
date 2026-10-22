export type CoverageFunction = { id: string; category: string; excluded: boolean };
export type CategoryCoverage = { category: string; reviewed: number; eligible: number; percent: number };

const CATEGORIES = ["entry", "core", "data", "helper"];

/** SCORE-3: reviewed vs eligible functions, per category and overall. */
export function coverage(
  functions: readonly CoverageFunction[],
  reviewedIds: ReadonlySet<string>,
): { categories: CategoryCoverage[]; overall: CategoryCoverage } {
  const tally = (list: readonly CoverageFunction[], category: string): CategoryCoverage => {
    const eligible = list.filter((f) => !f.excluded);
    const reviewed = eligible.filter((f) => reviewedIds.has(f.id)).length;
    return {
      category,
      reviewed,
      eligible: eligible.length,
      percent: eligible.length > 0 ? Math.round((reviewed / eligible.length) * 100) : 0,
    };
  };
  return {
    categories: CATEGORIES.map((c) => tally(functions.filter((f) => f.category === c), c)),
    overall: tally(functions, "all"),
  };
}
