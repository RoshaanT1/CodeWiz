import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_CONFIG"
  | "UPSTREAM"
  | "AI_ERROR"
  | "INVALID_URL";

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json(
    { ok: false as const, error: { code, message } },
    { status },
  );
}

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true as const, data }, { status });
}
