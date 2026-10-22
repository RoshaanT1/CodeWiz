import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { requireApiAal2Session } from "@/lib/auth/session";
import { apiError } from "@/lib/server/responses";
import { AI_CONFIG_COOKIE, getAiConfig } from "@/lib/ai/user-config";
import type { LlmProvider } from "@/lib/ai/call-json";

export const runtime = "nodejs";

const PROVIDERS = ["openai", "anthropic", "gemini", "groq", "openrouter", "qwen"] as const;

const SaveAiKeySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    provider: z.enum(PROVIDERS),
    apiKey: z.string().min(5, "API Key must be at least 5 characters"),
  }),
  z.object({
    action: z.literal("clear"),
  }),
]);

/**
 * GET /api/settings/ai-key
 * Returns whether a custom API key is configured and what provider is selected.
 * Never leaks the actual secret key to the client.
 */
export async function GET() {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return apiError(
      session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      session.reason,
      session.status,
    );
  }

  const config = await getAiConfig();
  const defaultProvider = (process.env.AI_PROVIDER as LlmProvider) || "openai";

  return NextResponse.json({
    ok: true,
    data: {
      provider: config.provider || defaultProvider,
      hasCustomKey: Boolean(config.apiKey),
    },
  });
}

/**
 * POST /api/settings/ai-key
 * Allows the user to plug in their own API key and provider.
 * Stored in a secure, HTTP-only cookie.
 */
export async function POST(request: Request) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return apiError(
      session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      session.reason,
      session.status,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON payload.", 400);
  }

  const parsed = SaveAiKeySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const cookieStore = await cookies();

  if (parsed.data.action === "clear") {
    cookieStore.delete(AI_CONFIG_COOKIE);
    return NextResponse.json({
      ok: true,
      message: "Custom API key cleared. Using server default keys.",
      data: {
        provider: (process.env.AI_PROVIDER as LlmProvider) || "openai",
        hasCustomKey: false,
      },
    });
  }

  const { provider, apiKey } = parsed.data;
  cookieStore.set(AI_CONFIG_COOKIE, JSON.stringify({ provider, apiKey }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return NextResponse.json({
    ok: true,
    message: `Custom API key saved for ${provider}.`,
    data: {
      provider,
      hasCustomKey: true,
    },
  });
}
