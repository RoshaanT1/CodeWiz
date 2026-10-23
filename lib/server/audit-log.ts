import "server-only";

import { randomUUID } from "node:crypto";

/**
 * Structured audit event logger for SOC readiness.
 * Writes structured JSON to stdout so Vercel log drains / SIEM pipelines
 * can ingest them. Each event has a correlation ID, event type, actor,
 * and optional metadata.
 *
 * Never logs secrets, tokens, or raw passwords.
 */

export type AuditEventType =
  | "auth.login"
  | "auth.logout"
  | "auth.2fa_verify"
  | "auth.2fa_fail"
  | "auth.session_denied"
  | "repo.import"
  | "repo.import_private_blocked"
  | "round.create"
  | "round.daily_cap_exceeded"
  | "quiz.generate"
  | "quiz.submit_answer"
  | "drill.generate"
  | "drill.submit"
  | "drill.real_bug_check"
  | "api.rate_limited"
  | "api.bad_request"
  | "api.unauthorized"
  | "api.forbidden"
  | "api.error";

export type AuditEvent = {
  /** Unique event ID for deduplication. */
  eventId: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Classification of the event. */
  eventType: AuditEventType;
  /** Request correlation ID (x-request-id or generated). */
  requestId: string;
  /** Authenticated user ID (null if unauthenticated). */
  userId: string | null;
  /** Route or endpoint that triggered the event. */
  route: string;
  /** HTTP method. */
  method: string;
  /** Additional structured context. Never includes secrets. */
  meta?: Record<string, unknown>;
};

/**
 * Generate a new request correlation ID.
 * Route handlers should call this once per request and thread it through.
 */
export function newRequestId(): string {
  return randomUUID();
}

/**
 * Emit a structured audit event to stdout.
 * In production, Vercel log drains forward these to SIEM / monitoring.
 */
export function emitAuditEvent(event: AuditEvent): void {
  const line = JSON.stringify({
    severity: "AUDIT",
    ...event,
  });
  console.log(line);
}

/**
 * Convenience: build and emit an audit event in one call.
 */
export function audit(
  eventType: AuditEventType,
  opts: {
    requestId?: string;
    userId?: string | null;
    route?: string;
    method?: string;
    meta?: Record<string, unknown>;
  } = {},
): void {
  emitAuditEvent({
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    eventType,
    requestId: opts.requestId ?? newRequestId(),
    userId: opts.userId ?? null,
    route: opts.route ?? "unknown",
    method: opts.method ?? "POST",
    meta: opts.meta,
  });
}
