import { describe, expect, it } from "vitest";

import { caughtBugIds, matchFlags } from "./match-flags";

const BUGS = [
  { id: "a", lineStart: 10, lineEnd: 10 },
  { id: "b", lineStart: 20, lineEnd: 22 },
];

describe("matchFlags", () => {
  it("catches flags on a planted line or one line either side", () => {
    const flags = [9, 10, 11, 19, 21, 23].map((line) => ({ line, comment: "x" }));
    expect(matchFlags(flags, BUGS).map((m) => (m.outcome === "caught" ? m.bugId : null))).toEqual([
      "a", "a", "a", "b", "b", "b",
    ]);
  });

  it("leaves flags two or more lines away unmatched", () => {
    const matches = matchFlags([{ line: 12, comment: "x" }, { line: 30, comment: "y" }], BUGS);
    expect(matches.every((m) => m.outcome === "unmatched")).toBe(true);
  });

  it("gives a flag between two bugs to the closer one", () => {
    const near = [{ id: "a", lineStart: 10, lineEnd: 10 }, { id: "b", lineStart: 12, lineEnd: 12 }];
    const [onA, between] = matchFlags([{ line: 10, comment: "" }, { line: 11, comment: "" }], near);
    expect(onA).toMatchObject({ outcome: "caught", bugId: "a" });
    expect(between).toMatchObject({ outcome: "caught", bugId: "a" });
  });

  it("counts each bug once however many flags catch it", () => {
    const matches = matchFlags([{ line: 10, comment: "" }, { line: 11, comment: "" }], BUGS);
    expect([...caughtBugIds(matches)]).toEqual(["a"]);
  });
});
