import { describe, expect, it } from "vitest";

import { gradeChoice } from "./grade-choice";

const OPTIONS = ["Returns null", "Throws an error", "Retries once", "Logs and continues"];

describe("gradeChoice", () => {
  it("gives full marks for the correct option", () => {
    expect(gradeChoice(2, 2, OPTIONS, "Line 14 retries before giving up.")).toEqual({ score: 2, feedback: "Correct. Line 14 retries before giving up." });
  });

  it("gives 0 and names the right answer otherwise", () => {
    const r = gradeChoice(0, 2, OPTIONS, "Line 14 retries before giving up.");
    expect(r.score).toBe(0);
    expect(r.feedback).toContain('"Retries once"');
  });
});
