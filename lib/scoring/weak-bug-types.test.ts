import { describe, expect, it } from "vitest";

import { weakBugTypes } from "./weak-bug-types";

const TYPES = ["off_by_one", "wrong_condition", "missing_guard", "wrong_return"];

describe("weakBugTypes", () => {
  it("returns nothing before any drill has been graded", () => {
    expect(weakBugTypes([], TYPES)).toEqual([]);
  });

  it("puts missed and untried types first, lowest catch rate first", () => {
    const rows = [
      { bug_type: "off_by_one", attempts: 4, caught: 4 },
      { bug_type: "wrong_condition", attempts: 2, caught: 1 },
      { bug_type: "missing_guard", attempts: 3, caught: 0 },
    ];
    expect(weakBugTypes(rows, TYPES)).toEqual(["missing_guard", "wrong_return", "wrong_condition"]);
  });

  it("respects the limit", () => {
    const rows = [{ bug_type: "off_by_one", attempts: 1, caught: 0 }];
    expect(weakBugTypes(rows, TYPES, 1)).toEqual(["off_by_one"]);
  });
});
