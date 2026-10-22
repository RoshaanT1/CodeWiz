import { describe, expect, it } from "vitest";

import { addDrillToSkills, catchRates } from "./skill-profile";

describe("addDrillToSkills", () => {
  it("adds an attempt per bug and a catch per caught bug, returning only touched types", () => {
    const existing = [
      { bugType: "off_by_one", attempts: 2, caught: 1 },
      { bugType: "wrong_return", attempts: 1, caught: 1 },
    ];
    const bugs = [
      { id: "a", bugType: "off_by_one" },
      { id: "b", bugType: "missing_guard" },
    ];
    expect(addDrillToSkills(existing, bugs, new Set(["a"]))).toEqual([
      { bugType: "off_by_one", attempts: 3, caught: 2 },
      { bugType: "missing_guard", attempts: 1, caught: 0 },
    ]);
  });

  it("computes catch rates and skips untried types", () => {
    expect(catchRates([{ bugType: "x", attempts: 4, caught: 1 }, { bugType: "y", attempts: 0, caught: 0 }])).toEqual([
      { bugType: "x", rate: 0.25, attempts: 4 },
    ]);
  });
});
