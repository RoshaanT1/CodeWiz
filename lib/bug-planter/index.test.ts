import { describe, expect, it } from "vitest";
import { plantBugs, type BugType, type LlmFunction, type ParseFunction } from "./index";

const SAMPLE_CODE = `function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].price > 0) {
      total += items[i].price;
    }
  }
  return total;
}`;

describe("plantBugs (Gig 2: Verified Bug Planter)", () => {
  it("plants and verifies valid bugs", async () => {
    const fakeLlm: LlmFunction = async <T>({ prompt }: { prompt: string }) => {
      if (prompt.includes("For each bug in order")) {
        // Behaviour check pass
        return {
          ok: true,
          data: {
            checks: [{ changes_behaviour: true, why: "Skips zero price check or miscalculates" }],
          } as unknown as T,
        };
      }

      // Plant pass
      const changedCode = SAMPLE_CODE.replace(
        "if (items[i].price > 0)",
        "if (items[i].price >= 0)",
      );
      return {
        ok: true,
        data: {
          changed_code: changedCode,
          bugs: [
            {
              line_start: 4,
              line_end: 4,
              bug_type: "wrong_condition" as BugType,
              explanation: "Comparison changed to include zero prices",
              fix: "Change back to > 0",
            },
          ],
        } as unknown as T,
      };
    };

    const res = await plantBugs({
      code: SAMPLE_CODE,
      language: "javascript",
      startLine: 1,
      llm: fakeLlm,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.bugs).toHaveLength(1);
      expect(res.bugs[0].bugType).toBe("wrong_condition");
      expect(res.bugs[0].lineStart).toBe(4);
      expect(res.changedCode).toContain("items[i].price >= 0");
    }
  });

  it("rejects output when line count changes", async () => {
    const fakeLlm: LlmFunction = async <T>() => ({
      ok: true,
      data: {
        changed_code: SAMPLE_CODE + "\n// Extra line",
        bugs: [
          {
            line_start: 1,
            line_end: 1,
            bug_type: "wrong_condition" as BugType,
            explanation: "test",
            fix: "test",
          },
        ],
      } as unknown as T,
    });

    const res = await plantBugs({
      code: SAMPLE_CODE,
      language: "javascript",
      startLine: 1,
      llm: fakeLlm,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("Line count mismatch");
    }
  });

  it("rejects unlisted diff lines", async () => {
    const fakeLlm: LlmFunction = async <T>() => {
      // Changes line 2 and line 4, but only reports line 4
      const changedCode = SAMPLE_CODE
        .replace("let total = 0;", "let total = 1;")
        .replace("items[i].price > 0", "items[i].price >= 0");
      return {
        ok: true,
        data: {
          changed_code: changedCode,
          bugs: [
            {
              line_start: 4,
              line_end: 4,
              bug_type: "wrong_condition" as BugType,
              explanation: "test",
              fix: "test",
            },
          ],
        } as unknown as T,
      };
    };

    const res = await plantBugs({
      code: SAMPLE_CODE,
      language: "javascript",
      startLine: 1,
      llm: fakeLlm,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("Diff touched unlisted line");
    }
  });

  it("rejects invalid bug types outside the catalogue", async () => {
    const fakeLlm: LlmFunction = async <T>() => ({
      ok: true,
      data: {
        changed_code: SAMPLE_CODE.replace("items[i].price > 0", "items[i].price >= 0"),
        bugs: [
          {
            line_start: 4,
            line_end: 4,
            bug_type: "unsupported_magic_bug" as unknown as BugType,
            explanation: "test",
            fix: "test",
          },
        ],
      } as unknown as T,
    });

    const res = await plantBugs({
      code: SAMPLE_CODE,
      language: "javascript",
      startLine: 1,
      llm: fakeLlm,
    });

    expect(res.ok).toBe(false);
  });

  it("rejects parse errors when parse function fails", async () => {
    const fakeLlm: LlmFunction = async <T>() => ({
      ok: true,
      data: {
        changed_code: SAMPLE_CODE.replace("let total = 0;", "let total = ;"),
        bugs: [
          {
            line_start: 2,
            line_end: 2,
            bug_type: "wrong_variable" as BugType,
            explanation: "Broken syntax",
            fix: "restore 0",
          },
        ],
      } as unknown as T,
    });

    const failParse: ParseFunction = async () => ({
      ok: false,
      reason: "Unexpected token ';'",
    });

    const res = await plantBugs({
      code: SAMPLE_CODE,
      language: "javascript",
      startLine: 1,
      llm: fakeLlm,
      parse: failParse,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("Unexpected token");
    }
  });

  it("rejects mutations introducing dangerous code execution syntax", async () => {
    const fakeLlm: LlmFunction = async <T>() => ({
      ok: true,
      data: {
        changed_code: SAMPLE_CODE.replace("let total = 0;", "let total = eval('0');"),
        bugs: [
          {
            line_start: 2,
            line_end: 2,
            bug_type: "wrong_variable" as BugType,
            explanation: "Injected eval call",
            fix: "remove eval",
          },
        ],
      } as unknown as T,
    });

    const res = await plantBugs({
      code: SAMPLE_CODE,
      language: "javascript",
      startLine: 1,
      llm: fakeLlm,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("prohibited dangerous execution syntax");
    }
  });
});
