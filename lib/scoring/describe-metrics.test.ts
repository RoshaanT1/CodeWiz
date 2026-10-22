import { describe, expect, it } from "vitest";

import { describeMetrics } from "./describe-metrics";

describe("describeMetrics", () => {
  it("describes a small standalone function", () => {
    const lines = describeMetrics({ length: 8, branches: 0, callers: 0, callees: 0, dataAccess: false });
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("fits on one screen");
    expect(lines[2]).toContain("entry point");
  });

  it("flags reach, many paths and data access without scoring the code", () => {
    const lines = describeMetrics({ length: 80, branches: 9, callers: 5, callees: 1, dataAccess: true });
    expect(lines.join(" ")).toContain("reaches a lot of code");
    expect(lines.join(" ")).toContain("edge cases");
    expect(lines.at(-1)).toContain("touches data");
    expect(lines.join(" ")).not.toMatch(/\b(good|bad|score)\b/i);
  });

  it("gets singular and plural right", () => {
    const lines = describeMetrics({ length: 20, branches: 1, callers: 1, callees: 1, dataAccess: false });
    expect(lines[1]).toMatch(/^1 branch \(/);
    expect(lines[2]).toBe("1 function calls it.");
    expect(lines[3]).toBe("It relies on 1 other function in the repo.");
  });
});
