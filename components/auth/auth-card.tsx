import Link from "next/link";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupabaseEnv } from "@/lib/supabase/env";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
};

/**
 * Shared frame for the sign-in and sign-up pages. Shows a clear message up
 * front when the Supabase variables are missing, instead of letting the form
 * fail later.
 */
export function AuthCard({ title, description, children }: Props) {
  const env = getSupabaseEnv();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <Link
        href="/"
        className="text-center text-2xl font-bold tracking-tight"
        aria-label="CodeWiz home"
      >
        CodeWiz
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!env.ok && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {env.reason}
            </p>
          )}
          {children}
        </CardContent>
      </Card>
    </main>
  );
}
