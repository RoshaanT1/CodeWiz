import { NextResponse } from "next/server";

import { SIGN_IN_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Sign-out action. POST only, so a link or an image tag on another site
 * can't sign someone out. The form in the dashboard header posts here.
 *
 * Signing out is best effort: whatever Supabase answers, the session cookies
 * are cleared by the client and the visitor lands on the sign-in page.
 */
export async function POST(request: Request) {
  const client = await createClient();

  if (client.ok) {
    try {
      await client.data.auth.signOut();
    } catch {
      // Network trouble must not trap someone in a signed-in state. The
      // middleware verifies the token on every request anyway.
    }
  }

  // 303 turns the POST into a GET on the sign-in page.
  return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url), {
    status: 303,
  });
}
