import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { checkRateLimit, type RateLimitConfig } from "./rate-limit";

// We re-import each test to get a fresh module, but in vitest with isolated modules
// the in-memory store is shared. We use unique keys per test to avoid collision.

describe("checkRateLimit", () => {
  const config: RateLimitConfig = { max: 3, windowMs: 10_000 };

  it("allows requests under the limit", () => {
    const key = "test-under-limit-" + Date.now();
    const r1 = checkRateLimit(key, config);
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, config);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, config);
    expect(r3.ok).toBe(true);
    if (r3.ok) expect(r3.remaining).toBe(0);
  });

  it("rejects requests over the limit", () => {
    const key = "test-over-limit-" + Date.now();
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);

    const r4 = checkRateLimit(key, config);
    expect(r4.ok).toBe(false);
    if (!r4.ok) {
      expect(r4.retryAfterMs).toBeGreaterThan(0);
      expect(r4.reason).toContain("Too many requests");
    }
  });

  it("different keys are independent", () => {
    const keyA = "test-key-a-" + Date.now();
    const keyB = "test-key-b-" + Date.now();

    checkRateLimit(keyA, config);
    checkRateLimit(keyA, config);
    checkRateLimit(keyA, config);

    // keyA is exhausted, keyB should still work.
    const rA = checkRateLimit(keyA, config);
    expect(rA.ok).toBe(false);

    const rB = checkRateLimit(keyB, config);
    expect(rB.ok).toBe(true);
  });

  it("uses a tight window that expires entries", async () => {
    const tinyConfig: RateLimitConfig = { max: 1, windowMs: 50 };
    const key = "test-expiry-" + Date.now();

    const r1 = checkRateLimit(key, tinyConfig);
    expect(r1.ok).toBe(true);

    const r2 = checkRateLimit(key, tinyConfig);
    expect(r2.ok).toBe(false);

    // Wait for the window to pass.
    await new Promise((r) => setTimeout(r, 60));

    const r3 = checkRateLimit(key, tinyConfig);
    expect(r3.ok).toBe(true);
  });
});
