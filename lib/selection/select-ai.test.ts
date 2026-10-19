import { describe, expect, it, vi } from "vitest";

import * as aiModule from "@/lib/ai/call-json";
import {
  computeImportance,
  isEligibleCandidate,
  rankCandidates,
  type FunctionCandidate,
} from "./rank";
import {
  fallbackSelectFunctions,
  selectFunctions,
  validatePicks,
} from "./select-ai";

describe("Candidate ranking and eligibility (SELECT-1)", () => {
  const sampleCandidates: FunctionCandidate[] = [
    {
      id: "fn-1",
      name: "handleAuth",
      qualifiedName: "Auth.handleAuth",
      file: "lib/auth/handler.ts",
      language: "typescript",
      startLine: 10,
      endLine: 45,
      length: 35,
      branches: 4,
      callers: 5,
      callees: 3,
      dataAccess: true,
      category: "core",
    },
    {
      id: "fn-2",
      name: "getUserProfile",
      qualifiedName: "getUserProfile",
      file: "lib/db/users.ts",
      language: "typescript",
      startLine: 1,
      endLine: 20,
      length: 19,
      branches: 2,
      callers: 2,
      callees: 1,
      dataAccess: true,
      category: "data",
    },
    {
      id: "fn-trivial",
      name: "noop",
      qualifiedName: "noop",
      file: "lib/utils.ts",
      language: "typescript",
      startLine: 1,
      endLine: 3,
      length: 3, // < 5 lines
      branches: 0,
      callers: 0,
      callees: 0,
      dataAccess: false,
      category: "helper",
    },
    {
      id: "fn-test",
      name: "testHandler",
      qualifiedName: "testHandler",
      file: "tests/auth.test.ts", // test file
      language: "typescript",
      startLine: 1,
      endLine: 20,
      length: 20,
      branches: 2,
      callers: 1,
      callees: 1,
      dataAccess: false,
      category: "helper",
    },
  ];

  it("calculates importance according to contract formula", () => {
    // 3 * ln(1 + 5) + 2 * 1 + min(4, 10)/10 + 0.5 * ln(1 + 3)
    // 3 * ln(6) + 2 + 0.4 + 0.5 * ln(4)
    // 3 * 1.791759 + 2 + 0.4 + 0.5 * 1.386294 = 5.375277 + 2.4 + 0.693147 = 8.4684
    const score = computeImportance({
      callers: 5,
      callees: 3,
      dataAccess: true,
      branches: 4,
    });
    expect(score).toBeCloseTo(8.4684, 2);
  });

  it("correctly identifies eligible candidates and excludes test/trivial ones", () => {
    expect(isEligibleCandidate(sampleCandidates[0])).toBe(true);
    expect(isEligibleCandidate(sampleCandidates[1])).toBe(true);
    expect(isEligibleCandidate(sampleCandidates[2])).toBe(false); // < 5 lines
    expect(isEligibleCandidate(sampleCandidates[3])).toBe(false); // test file
  });

  it("ranks eligible candidates by importance score descending", () => {
    const ranked = rankCandidates(sampleCandidates);
    expect(ranked.length).toBe(2);
    expect(ranked[0].id).toBe("fn-1");
    expect(ranked[1].id).toBe("fn-2");
  });
});

describe("Deterministic fallback selection", () => {
  const candidates: FunctionCandidate[] = [
    {
      id: "entry-1",
      name: "routeHandler",
      qualifiedName: "routeHandler",
      file: "app/api/route.ts",
      language: "typescript",
      startLine: 1,
      endLine: 25,
      length: 24,
      branches: 3,
      callers: 0,
      callees: 4,
      dataAccess: false,
      category: "entry",
    },
    {
      id: "data-1",
      name: "fetchRepo",
      qualifiedName: "fetchRepo",
      file: "lib/repo.ts",
      language: "typescript",
      startLine: 1,
      endLine: 30,
      length: 29,
      branches: 2,
      callers: 2,
      callees: 2,
      dataAccess: true,
      category: "data",
    },
    {
      id: "core-1",
      name: "processAST",
      qualifiedName: "processAST",
      file: "lib/ast.ts",
      language: "typescript",
      startLine: 1,
      endLine: 50,
      length: 49,
      branches: 8,
      callers: 6,
      callees: 5,
      dataAccess: false,
      category: "core",
    },
    {
      id: "helper-1",
      name: "formatDate",
      qualifiedName: "formatDate",
      file: "lib/format.ts",
      language: "typescript",
      startLine: 1,
      endLine: 15,
      length: 14,
      branches: 2,
      callers: 1,
      callees: 0,
      dataAccess: false,
      category: "helper",
    },
  ];

  it("spreads across categories and respects requested round size", () => {
    const picks = fallbackSelectFunctions(candidates, 3);
    expect(picks.length).toBe(3);

    const pickedIds = picks.map((p) => p.function_id);
    expect(new Set(pickedIds).size).toBe(3); // unique
    expect(picks[0].reason).toContain("Selected as a high-impact");
  });
});

describe("validatePicks post-AI code checks", () => {
  const candidates: FunctionCandidate[] = [
    {
      id: "fn-a",
      name: "a",
      qualifiedName: "a",
      file: "a.ts",
      language: "typescript",
      startLine: 1,
      endLine: 10,
      length: 9,
      branches: 1,
      callers: 1,
      callees: 1,
      dataAccess: false,
      category: "core",
    },
    {
      id: "fn-b",
      name: "b",
      qualifiedName: "b",
      file: "b.ts",
      language: "typescript",
      startLine: 1,
      endLine: 10,
      length: 9,
      branches: 1,
      callers: 1,
      callees: 1,
      dataAccess: false,
      category: "data",
    },
  ];

  it("accepts valid picks matching candidates", () => {
    const valid = validatePicks(
      [
        { function_id: "fn-a", reason: "Good" },
        { function_id: "fn-b", reason: "Nice" },
      ],
      candidates,
      2,
    );
    expect(valid).toBe(true);
  });

  it("rejects unknown function IDs not in candidates", () => {
    const invalid = validatePicks(
      [{ function_id: "fn-unknown", reason: "Bad" }],
      candidates,
      1,
    );
    expect(invalid).toBe(false);
  });

  it("rejects duplicate picks", () => {
    const invalid = validatePicks(
      [
        { function_id: "fn-a", reason: "First" },
        { function_id: "fn-a", reason: "Duplicate" },
      ],
      candidates,
      2,
    );
    expect(invalid).toBe(false);
  });

  it("rejects count mismatch", () => {
    const invalid = validatePicks(
      [{ function_id: "fn-a", reason: "One only" }],
      candidates,
      2,
    );
    expect(invalid).toBe(false);
  });
});

describe("selectFunctions orchestrator (SELECT-2)", () => {
  const candidates: FunctionCandidate[] = [
    {
      id: "fn-1",
      name: "f1",
      qualifiedName: "f1",
      file: "f1.ts",
      language: "typescript",
      startLine: 1,
      endLine: 10,
      length: 9,
      branches: 2,
      callers: 2,
      callees: 1,
      dataAccess: false,
      category: "core",
    },
    {
      id: "fn-2",
      name: "f2",
      qualifiedName: "f2",
      file: "f2.ts",
      language: "typescript",
      startLine: 1,
      endLine: 10,
      length: 9,
      branches: 1,
      callers: 1,
      callees: 1,
      dataAccess: true,
      category: "data",
    },
  ];

  it("uses AI output when valid and verified", async () => {
    vi.spyOn(aiModule, "callJson").mockResolvedValueOnce({
      ok: true,
      data: {
        picks: [
          { function_id: "fn-1", reason: "Core business logic" },
          { function_id: "fn-2", reason: "Data persistence handler" },
        ],
      },
      tokens: { prompt: 50, completion: 20 },
      durationMs: 300,
      attempts: 1,
    });

    const result = await selectFunctions({ candidates, roundSize: 2 });
    expect(result.ok).toBe(true);
    expect(result.usedAi).toBe(true);
    expect(result.picks[0].function_id).toBe("fn-1");
    expect(result.picks[1].function_id).toBe("fn-2");
  });

  it("falls back to deterministic selection when AI returns invalid IDs", async () => {
    vi.spyOn(aiModule, "callJson").mockResolvedValueOnce({
      ok: true,
      data: {
        picks: [
          { function_id: "fn-hallucinated", reason: "Fake ID" },
        ],
      },
      tokens: { prompt: 50, completion: 20 },
      durationMs: 300,
      attempts: 1,
    });

    const result = await selectFunctions({ candidates, roundSize: 1 });
    expect(result.ok).toBe(true);
    expect(result.usedAi).toBe(false);
    expect(result.picks[0].function_id).toBe("fn-2");
  });

  it("falls back to deterministic selection when AI call errors", async () => {
    vi.spyOn(aiModule, "callJson").mockResolvedValueOnce({
      ok: false,
      reason: "API rate limited",
      attempts: 2,
    });

    const result = await selectFunctions({ candidates, roundSize: 2 });
    expect(result.ok).toBe(true);
    expect(result.usedAi).toBe(false);
    expect(result.picks.length).toBe(2);
  });
});
