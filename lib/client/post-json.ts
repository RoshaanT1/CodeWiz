type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

/** POSTs JSON to one of our routes and unwraps { ok, data } or { ok: false, error }. */
export async function postJson<T>(url: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json()) as ApiResponse<T>;
    return json.ok ? { ok: true, data: json.data } : { ok: false, message: json.error.message };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

const inFlight = new Map<string, Promise<{ ok: true; data: unknown } | { ok: false; message: string }>>();

/**
 * POSTs with no body, sharing one request per URL while it's in flight. Lets
 * the round flow prepare the next step in the background without the screen
 * starting a second, duplicate generation for the same function.
 */
export function postOnce<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  let pending = inFlight.get(url);
  if (!pending) {
    pending = postJson<unknown>(url).finally(() => inFlight.delete(url));
    inFlight.set(url, pending);
  }
  return pending as Promise<{ ok: true; data: T } | { ok: false; message: string }>;
}
