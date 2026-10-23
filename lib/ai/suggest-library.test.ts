import { describe, expect, it, vi } from "vitest";

import { suggestLibrary } from "./suggest-library";

const INPUT = {
  code: "function debounce(fn, ms) {\n  let t;\n  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };\n}",
  startLine: 5,
  language: "javascript" as const,
};

const SUGGESTION = {
  ecosystem: "npm" as const,
  package: "debounce",
  function: "debounce",
  docs_url: "https://evil.example/phish",
  why: "It handles immediate calls and cancellation, which this version doesn't.",
};

const llmReturning = (data: unknown) => vi.fn(async () => ({ ok: true as const, data })) as never;

const verified = (exists: boolean, ok = exists) =>
  vi.fn(async () => ({
    exists,
    mentionedInDocs: ok,
    docsUrl: exists ? "https://github.com/sindresorhus/debounce#readme" : null,
  }));

describe("suggestLibrary", () => {
  it("returns a verified suggestion with the registry's docs link, not the model's", async () => {
    const result = await suggestLibrary(INPUT, { llm: llmReturning({ suggestion: SUGGESTION }), verify: verified(true) });
    expect(result).toEqual({
      ok: true,
      data: {
        ecosystem: "npm",
        package: "debounce",
        functionName: "debounce",
        docsUrl: "https://github.com/sindresorhus/debounce#readme",
        why: SUGGESTION.why,
      },
    });
    expect(JSON.stringify(result)).not.toContain("evil.example");
  });

  it("drops made-up packages and undocumented functions", async () => {
    expect(await suggestLibrary(INPUT, { llm: llmReturning({ suggestion: SUGGESTION }), verify: verified(false) })).toMatchObject({
      ok: true,
      data: null,
      dropped: "debounce doesn't exist",
    });
    expect(await suggestLibrary(INPUT, { llm: llmReturning({ suggestion: SUGGESTION }), verify: verified(true, false) })).toMatchObject({
      ok: true,
      data: null,
    });
  });

  it("drops a PyPI suggestion for JavaScript code without checking the registry", async () => {
    const verify = verified(true);
    const result = await suggestLibrary(INPUT, { llm: llmReturning({ suggestion: { ...SUGGESTION, ecosystem: "pypi" } }), verify });
    expect(result).toMatchObject({ ok: true, data: null });
    expect(verify).not.toHaveBeenCalled();
  });

  it("returns null when the model has no suggestion", async () => {
    const verify = verified(true);
    expect(await suggestLibrary(INPUT, { llm: llmReturning({ suggestion: null }), verify })).toEqual({ ok: true, data: null });
    expect(verify).not.toHaveBeenCalled();
  });

  it("puts the numbered code inside untrusted delimiters", async () => {
    const llm = vi.fn(async () => ({ ok: true as const, data: { suggestion: null } }));
    await suggestLibrary(INPUT, { llm: llm as never, verify: verified(true) });
    const [{ prompt }] = llm.mock.calls[0] as unknown as [{ prompt: string }];
    expect(prompt).toContain("5: function debounce(fn, ms) {");
    expect(prompt).toContain("UNTRUSTED");
  });
});
