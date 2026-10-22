import { cookies } from "next/headers";
import type { LlmProvider } from "./call-json";

export const AI_CONFIG_COOKIE = "cw_user_ai_config";

export type UserAiConfig = {
  provider?: LlmProvider;
  apiKey?: string;
};

/**
 * Reads the user's custom AI configuration from the secure cookie.
 * If not set or invalid, returns empty object (falling back to server environment variables).
 */
export async function getAiConfig(): Promise<UserAiConfig> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(AI_CONFIG_COOKIE)?.value;
    if (!raw) return {};

    const parsed = JSON.parse(raw) as UserAiConfig;
    return {
      provider: parsed.provider,
      apiKey: parsed.apiKey?.trim() ? parsed.apiKey.trim() : undefined,
    };
  } catch {
    return {};
  }
}
