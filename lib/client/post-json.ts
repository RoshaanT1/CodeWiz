type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

/** POSTs JSON to one of our routes and unwraps { ok, data } or { ok: false, error }. */
export async function postJson<T>(url: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
  try {
    const json = (await res.json()) as ApiResponse<T>;
    return json.ok ? { ok: true, data: json.data } : { ok: false, message: json.error.message };
  } catch {
    // The server answered, but not with our JSON: it crashed or timed out.
    return {
      ok: false,
      message:
        res.status === 504
          ? "That took too long and timed out. Try again, or for a big repo import just one folder."
          : `The server ran into an error (${res.status}). Try again in a moment.`,
    };
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
