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
} as const;

/**
 * Frame for the sign-in and sign-up pages. Shows a clear message up front
 * when the Supabase variables are missing, instead of letting the form fail
 * later.
 */
export function AuthCard({ mode, children }: { mode: AuthMode; children: ReactNode }) {
  const env = getSupabaseEnv();
  const copy = COPY[mode];

  return (
    <div className="min-h-[100dvh]">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          Back to home
        </Link>
      </header>
      <main className="mx-auto grid max-w-[920px] items-center gap-14 px-5 py-14 md:grid-cols-[1fr_380px]">
        <div className="hidden md:block">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
            <Code2 size={20} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{copy.heading}</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{copy.blurb}</p>
          <div className="mt-8 border-l-2 border-primary/40 pl-4 text-sm leading-6 text-muted-foreground">
            “The first step to fixing a bug is being able to explain what the code does.”
          </div>
        </div>
        <div>
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
      </main>
    </div>
  );
}
