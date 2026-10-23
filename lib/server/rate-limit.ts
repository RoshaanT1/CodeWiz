import "server-only";

/**
 * In-memory sliding-window rate limiter.
 * Tracks request timestamps per key (typically user ID or IP) and rejects
 * requests that exceed the configured window/max.
 *
 * Not shared across Vercel serverless instances, so this provides
 * best-effort rate limiting per container — enough to stop simple abuse.
 * For stricter enforcement, pair with the PostgreSQL-backed daily cap.
 */

type Entry = {
  timestamps: number[];
};

const store = new Map<string, Entry>();

/** Evict stale entries every 5 minutes to avoid unbounded growth. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export type RateLimitConfig = {
  /** Maximum requests allowed within the window. */
  max: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number; reason: string };

/**
 * Check and record a request against the sliding window.
 * Returns ok: false if the key has exceeded its limit.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  cleanup(config.windowMs);

  const cutoff = now - config.windowMs;
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps.
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.max) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + config.windowMs - now;
    return {
      ok: false,
      retryAfterMs: Math.max(retryAfterMs, 1000),
      reason: `Too many requests. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
    };
  }

  entry.timestamps.push(now);
  return { ok: true, remaining: config.max - entry.timestamps.length };
}

/** Predefined rate limit profiles. */
export const RATE_LIMITS = {
  /** POST /api/rounds: max 5 per minute per user. */
  roundCreate: { max: 5, windowMs: 60_000 } satisfies RateLimitConfig,
  /** POST /api/repos: max 10 per minute per user. */
  repoImport: { max: 10, windowMs: 60_000 } satisfies RateLimitConfig,
  /** AI-heavy endpoints (quiz, drill, grade): max 10 per minute. */
  aiCall: { max: 10, windowMs: 60_000 } satisfies RateLimitConfig,
  /** General API: max 60 per minute per user. */
  general: { max: 60, windowMs: 60_000 } satisfies RateLimitConfig,
} as const;
