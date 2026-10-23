// GET /auth/confirm: the link in the password reset email lands here. It
// checks the one-time token (which works in any browser, unlike a code tied to
// the one that asked), signs the user in for the reset, and opens the reset
// page. A bad or used link goes back to the forgot password page.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const QuerySchema = z.object({
  token_hash: z.string().min(10).max(500),
  type: z.literal("recovery"),
});

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const expired = NextResponse.redirect(new URL(`${FORGOT_PASSWORD_PATH}?expired=1`, origin));

  const query = QuerySchema.safeParse({ token_hash: searchParams.get("token_hash"), type: searchParams.get("type") });
  if (!query.success) return expired;

  const client = await createClient();
  if (!client.ok) return expired;
  const { error } = await client.data.auth.verifyOtp({ token_hash: query.data.token_hash, type: "recovery" });
  if (error) return expired;

  return NextResponse.redirect(new URL(RESET_PASSWORD_PATH, origin));
}
