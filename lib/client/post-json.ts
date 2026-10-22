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
