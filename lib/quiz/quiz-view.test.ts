import { describe, expect, it } from "vitest";

import { toQuizView } from "./quiz-view";

const row = (answer: string | null) => ({ id: "q", kind: "purpose", question: "Why?", answer, score: null, feedback: null });

describe("toQuizView", () => {
  it("hides the explanation until every question is answered", () => {
    expect(toQuizView([row("a"), row(null)], "secret").explanation).toBeNull();
    expect(toQuizView([row("a"), row("")], "secret").explanation).toBe("secret");
    expect(toQuizView([], "secret").explanation).toBeNull();
  });

  it("never includes rubrics", () => {
    const view = toQuizView([{ ...row(null), rubric: { key_points: ["x"] } } as never], null);
    expect(JSON.stringify(view)).not.toContain("key_points");
  });
});
