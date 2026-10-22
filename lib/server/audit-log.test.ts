import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { audit, newRequestId, emitAuditEvent, type AuditEvent } from "./audit-log";

describe("audit-log", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("newRequestId returns a UUID string", () => {
    const id = newRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("emitAuditEvent writes structured JSON to stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const event: AuditEvent = {
      eventId: "test-event-id",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventType: "round.create",
      requestId: "test-request-id",
      userId: "user-123",
      route: "/api/rounds",
      method: "POST",
      meta: { roundId: "round-abc" },
    };

    emitAuditEvent(event);

    expect(spy).toHaveBeenCalledOnce();
    const loggedLine = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(loggedLine);
    expect(parsed.severity).toBe("AUDIT");
    expect(parsed.eventType).toBe("round.create");
    expect(parsed.userId).toBe("user-123");
    expect(parsed.requestId).toBe("test-request-id");
    expect(parsed.meta.roundId).toBe("round-abc");
  });

  it("audit() convenience emits a complete event", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    audit("api.rate_limited", {
      userId: "user-456",
      route: "/api/repos",
      method: "POST",
      meta: { retryAfterMs: 5000 },
    });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.severity).toBe("AUDIT");
    expect(parsed.eventType).toBe("api.rate_limited");
    expect(parsed.userId).toBe("user-456");
    expect(parsed.eventId).toBeTruthy();
    expect(parsed.timestamp).toBeTruthy();
    expect(parsed.requestId).toBeTruthy();
  });
});
