import { Code2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/app-shell/page-parts";
import type { AuthMode } from "@/lib/auth/messages";
import { getSupabaseEnv } from "@/lib/supabase/env";

const COPY = {
  "sign-in": {
    heading: "Welcome back.",
    blurb: "Your practice workspace is ready when you are.",
  },
  "sign-up": {
    heading: "A better way to read code.",
    blurb: "Practice with real functions, build stronger code-reading instincts, and keep your work private.",
  },
  forgot: {
    heading: "It happens to everyone.",
    blurb: "We'll email you a link to choose a new password. Your practice history stays as it is.",
  },
  reset: {
    heading: "Choose a new password.",
    blurb: "If your account uses 2FA, you'll confirm it with your authenticator app first.",
  },
} as const;

/**
 * Frame for the sign-in and sign-up pages. Shows a clear message up front
 * when the Supabase variables are missing, instead of letting the form fail
 * later.
 */
export function AuthCard({ mode, children }: { mode: AuthMode | "forgot" | "reset"; children: ReactNode }) {
  const env = getSupabaseEnv();
  const copy = COPY[mode];

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          Back to home
        </Link>
      </header>
      {/* The content sits in the middle of the space left under the header. */}
      <main className="mx-auto flex w-full max-w-[1040px] flex-1 items-center px-5 pb-16 pt-4 md:pb-24">
        <div className="grid w-full items-center gap-12 md:grid-cols-[minmax(0,1fr)_400px] lg:gap-20">
          <div className="hidden md:block">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary">
              <Code2 size={22} />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">{copy.heading}</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">{copy.blurb}</p>
            <div className="mt-8 max-w-md border-l-2 border-primary/40 pl-4 text-sm leading-6 text-muted-foreground">
              “The first step to fixing a bug is being able to explain what the code does.”
            </div>
          </div>
          <div className="mx-auto w-full max-w-[400px]">
            {!env.ok && (
              <p
                role="alert"
                className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
              >
                {env.reason}
              </p>
            )}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
