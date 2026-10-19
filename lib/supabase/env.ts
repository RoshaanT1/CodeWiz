// Reads the Supabase variables shared by the browser and server clients.
// Both are safe for the browser (NEXT_PUBLIC_*). They must be referenced as
// literal `process.env.NEXT_PUBLIC_*` expressions so Next.js can inline them
// into browser code, so don't read them through a dynamic key.

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

export type SupabaseEnvResult =
  | { ok: true; data: SupabaseEnv }
  | { ok: false; reason: string };

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function getSupabaseEnv(): SupabaseEnvResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (missing.length > 0 || !url || !publishableKey) {
    return {
      ok: false,
      reason: `Supabase is not configured. Missing: ${missing.join(", ")}. Add the value in the workspace Secrets panel, or in .env.local when running locally, then restart the dev server.`,
    };
  }

  if (!isHttpUrl(url)) {
    return {
      ok: false,
      reason:
        "Supabase is not configured. NEXT_PUBLIC_SUPABASE_URL must be a full URL such as https://your-project.supabase.co.",
    };
  }

  return { ok: true, data: { url, publishableKey } };
}
