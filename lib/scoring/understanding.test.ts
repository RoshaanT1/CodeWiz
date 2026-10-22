import { describe, expect, it } from "vitest";

import { understandingScore } from "./understanding";

describe("understandingScore", () => {
  it("weights quiz, drill and defend 40/40/20", () => {
    const result = understandingScore({
      quizScores: [2, 2],
      drill: { plantedBugs: 2, caughtBugs: 2, explanationScores: [2, 2], falseAlarms: 0 },
      defendScores: [0],
    });
    expect(result).toEqual({ score: 80, quizPart: 1, drillPart: 1, defendPart: 0 });
  });

  it("counts quiz and drill 50% each without suggestions", () => {
    const result = understandingScore({
      quizScores: [2, 1],
      drill: { plantedBugs: 2, caughtBugs: 1, explanationScores: [2], falseAlarms: 0 },
      defendScores: [],
    });
    // quiz 0.75, drill 0.7 * 0.5 + 0.3 * 1 = 0.65
    expect(result.score).toBe(70);
    expect(result.defendPart).toBeNull();
  });

  it("takes 0.1 off the drill part per false alarm, never below 0", () => {
    const drill = { plantedBugs: 1, caughtBugs: 0, explanationScores: [], falseAlarms: 3 };
    expect(understandingScore({ quizScores: [], drill, defendScores: [] })).toMatchObject({ score: 0, drillPart: 0 });
  });

  it("uses only the quiz when the drill was skipped", () => {
    expect(understandingScore({ quizScores: [2, 1], drill: null, defendScores: [] }).score).toBe(75);
  });

  it("scores 0 with no data at all", () => {
    expect(understandingScore({ quizScores: [], drill: null, defendScores: [] }).score).toBe(0);
  });
});
