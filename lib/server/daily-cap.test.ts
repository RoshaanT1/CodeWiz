import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { checkAiCap } from "./daily-cap";

function fakeDb(row: { ai_calls: number } | null, error: unknown = null) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: row, error }) };
  return { from: () => chain } as never;
}

describe("checkAiCap", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows calls under the limit and with no usage row yet", async () => {
    expect(await checkAiCap(fakeDb({ ai_calls: 299 }), "u")).toEqual({ ok: true });
    expect(await checkAiCap(fakeDb(null), "u")).toEqual({ ok: true });
  });

  it("blocks at the limit with a friendly message", async () => {
    const result = await checkAiCap(fakeDb({ ai_calls: 300 }), "u");
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain("come back tomorrow");
  });

  it("reads DAILY_AI_CALL_LIMIT", async () => {
    vi.stubEnv("DAILY_AI_CALL_LIMIT", "5");
    expect(await checkAiCap(fakeDb({ ai_calls: 5 }), "u")).toMatchObject({ ok: false });
  });

  it("lets the request through when usage can't be read", async () => {
    expect(await checkAiCap(fakeDb(null, { message: "down" }), "u")).toEqual({ ok: true });
  });
});
