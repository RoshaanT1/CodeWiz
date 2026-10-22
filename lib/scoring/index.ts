/**
 * lib/scoring — understanding score, skill profile, and coverage.
 *
 * Formulas from docs/ARCHITECTURE.md:
 *
 * Understanding score (0-100):
 *   - Quiz part (40%):   average quiz score / 2
 *   - Drill part (40%):  0.7 × catch_rate + 0.3 × avg_explanation_score/2 − 0.1 × false_alarms
 *   - Defend part (20%): average reasoning score / 2
 *   If no suggestions: quiz and drill count 50% each.
 *
 * Skill profile: caught / attempts per bug_type.
 * Coverage: reviewed / eligible per category.
 */

export type QuizGrade = { score: number }; // score 0-2

export type DrillGrade = {
  caughtCount: number;
  totalBugs: number;
  avgExplanationScore: number; // 0-2
  falseAlarmCount: number;
};

export type DefendGrade = { reasonScore: number }; // score 0-2, or null if no suggestions

export function computeUnderstandingScore(
  quiz: QuizGrade[],
  drill: DrillGrade,
  defend?: DefendGrade[],
): number {
  const quizPart =
    quiz.length === 0 ? 0 : quiz.reduce((s, q) => s + q.score / 2, 0) / quiz.length;

  const catchRate = drill.totalBugs === 0 ? 0 : drill.caughtCount / drill.totalBugs;
  const drillPart = Math.max(
    0,
    0.7 * catchRate +
      0.3 * (drill.avgExplanationScore / 2) -
      0.1 * drill.falseAlarmCount,
  );

  const hasDefend = defend && defend.length > 0;
  const defendPart = hasDefend
    ? defend.reduce((s, d) => s + d.reasonScore / 2, 0) / defend.length
    : null;

  let score: number;
  if (defendPart === null) {
    // No suggestions: 50/50 split.
    score = 0.5 * quizPart + 0.5 * drillPart;
  } else {
    score = 0.4 * quizPart + 0.4 * drillPart + 0.2 * defendPart;
  }

  return Math.round(Math.min(100, Math.max(0, score * 100)));
}

export type BugTypeStat = { bugType: string; attempts: number; caught: number };

export function computeCatchRate(stats: BugTypeStat[]): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const s of stats) {
    rates[s.bugType] = s.attempts === 0 ? 0 : s.caught / s.attempts;
  }
  return rates;
}

/** Returns bug types sorted by catch rate ascending (weakest first). */
export function weakBugTypes(rates: Record<string, number>, top = 3): string[] {
  return Object.entries(rates)
    .filter(([, rate]) => rate < 1) // skip perfect rates
    .sort(([, a], [, b]) => a - b)
    .slice(0, top)
    .map(([type]) => type);
}

export type FunctionCoverage = {
  category: string;
  reviewed: number;
  eligible: number;
};

export function computeCoverage(
  functions: { category: string; excluded: boolean; explained: boolean }[],
): FunctionCoverage[] {
  const categories = ["entry", "core", "data", "helper"] as const;
  return categories.map((cat) => {
    const eligible = functions.filter(
      (f) => f.category === cat && !f.excluded,
    );
    const reviewed = eligible.filter((f) => f.explained);
    return { category: cat, eligible: eligible.length, reviewed: reviewed.length };
  });
}
