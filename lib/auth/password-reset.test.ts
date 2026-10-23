import { describe, expect, it } from "vitest";

import { describeResetError, requestPasswordReset, resetRedirectUrl, validateNewPassword } from "./password-reset";

type ResetError = { message: string; code?: string; status?: number } | null;

function fakeAuth(error: ResetError) {
  const calls: { email: string; redirectTo?: string }[] = [];
  return {
    calls,
    auth: {
      resetPasswordForEmail: async (email: string, options?: { redirectTo?: string }) => {
        calls.push({ email, redirectTo: options?.redirectTo });
        return { error };
      },
    },
  };
}

describe("password reset", () => {
  it("sends the link back through /auth/confirm on this site", async () => {
    const fake = fakeAuth(null);
    const result = await requestPasswordReset(fake, "a@b.co", "https://codewiz.test");
    expect(result).toEqual({ ok: true });
    expect(fake.calls[0]).toEqual({ email: "a@b.co", redirectTo: "https://codewiz.test/auth/confirm" });
    expect(resetRedirectUrl("http://localhost:3000")).toBe("http://localhost:3000/auth/confirm");
  });

  it("doesn't reveal whether an account exists", async () => {
    const result = await requestPasswordReset(fakeAuth({ message: "User not found", code: "user_not_found", status: 400 }), "nobody@b.co", "https://x.test");
    expect(result).toEqual({ ok: true });
  });

  it("explains the email rate limit", async () => {
    const result = await requestPasswordReset(fakeAuth({ message: "rate", code: "over_email_send_rate_limit", status: 429 }), "a@b.co", "https://x.test");
    expect(result.ok).toBe(false);
  });

  it("checks the new password", () => {
    expect(validateNewPassword("short", "short")).toMatch(/at least 8/);
    expect(validateNewPassword("long-enough-1", "long-enough-2")).toMatch(/don't match/);
    expect(validateNewPassword("long-enough-1", "long-enough-1")).toBeNull();
    expect(describeResetError({ message: "x", code: "same_password" })).toMatch(/different/);
  });
});
