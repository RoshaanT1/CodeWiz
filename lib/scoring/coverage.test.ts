import { describe, expect, it } from "vitest";

import { coverage } from "./coverage";

describe("coverage", () => {
  it("counts reviewed eligible functions per category and ignores excluded ones", () => {
    const fns = [
      { id: "a", category: "core", excluded: false },
      { id: "b", category: "core", excluded: false },
      { id: "c", category: "core", excluded: true },
      { id: "d", category: "entry", excluded: false },
    ];
    const result = coverage(fns, new Set(["a", "c"]));
    expect(result.categories.find((c) => c.category === "core")).toEqual({ category: "core", reviewed: 1, eligible: 2, percent: 50 });
    expect(result.categories.find((c) => c.category === "data")).toEqual({ category: "data", reviewed: 0, eligible: 0, percent: 0 });
    expect(result.overall).toEqual({ category: "all", reviewed: 1, eligible: 3, percent: 33 });
  });
});
