export type UnderstandingInput = {
  /** Quiz scores, each 0 to 2. Empty when the function had no quiz. */
  quizScores: readonly number[];
  /** Null when the function had no drill (skipped or not reached). */
  drill: {
    plantedBugs: number;
    caughtBugs: number;
    /** Explanation scores (0 to 2) of the caught bugs. */
    explanationScores: readonly number[];
    falseAlarms: number;
  } | null;
  /** Reasoning scores (0 to 2) from suggestion cards. Empty when there were none. */
  defendScores: readonly number[];
};

export type UnderstandingScore = {
  score: number;
  quizPart: number | null;
  drillPart: number | null;
  defendPart: number | null;
};

const average = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** Starting weights from ARCHITECTURE.md "Scoring". */
const WEIGHTS = { quiz: 0.4, drill: 0.4, defend: 0.2 };

/**
 * SCORE-1: understanding score 0 to 100. Each part is 0 to 1. Parts with no
 * data are left out and the remaining weights are scaled up, so a function
 * without suggestions counts quiz and drill 50% each.
 */
export function understandingScore(input: UnderstandingInput): UnderstandingScore {
  const quizPart = input.quizScores.length > 0 ? average(input.quizScores) / 2 : null;

  let drillPart: number | null = null;
  if (input.drill && input.drill.plantedBugs > 0) {
    const catchRate = input.drill.caughtBugs / input.drill.plantedBugs;
    const explanation = input.drill.explanationScores.length > 0 ? average(input.drill.explanationScores) / 2 : 0;
    drillPart = Math.max(0, Math.min(1, 0.7 * catchRate + 0.3 * explanation - 0.1 * input.drill.falseAlarms));
  }

  const defendPart = input.defendScores.length > 0 ? average(input.defendScores) / 2 : null;

  const parts = [
    { value: quizPart, weight: WEIGHTS.quiz },
    { value: drillPart, weight: WEIGHTS.drill },
    { value: defendPart, weight: WEIGHTS.defend },
  ].filter((p): p is { value: number; weight: number } => p.value !== null);
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const score = totalWeight > 0 ? parts.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight : 0;

  return { score: Math.round(score * 100), quizPart, drillPart, defendPart };
}
