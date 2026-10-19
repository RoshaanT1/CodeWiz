"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitCredentials, validateCredentials } from "@/lib/auth/credentials";
import type { AuthMode } from "@/lib/auth/messages";
import { DEFAULT_AFTER_SIGN_IN } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

type Props = {
  mode: AuthMode;
  /** Safe in-app path to open after signing in. */
  next: string;
};

const COPY = {
  "sign-in": {
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "New to CodeWiz?",
    switchLabel: "Create an account",
    switchHref: "/sign-up",
    passwordAutoComplete: "current-password",
  },
  "sign-up": {
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
    passwordAutoComplete: "new-password",
  },
} as const;

export function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const copy = COPY[mode];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const switchHref =
    next === DEFAULT_AFTER_SIGN_IN
      ? copy.switchHref
      : `${copy.switchHref}?next=${encodeURIComponent(next)}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setNotice(null);

    const invalid = validateCredentials(email, password, mode);
    if (invalid) {
      setError(invalid);
      return;
    }

    const client = createClient();
    if (!client.ok) {
      setError(client.reason);
      return;
    }

    setPending(true);
    const outcome = await submitCredentials(
      client.data,
      mode,
      email.trim(),
      password,
    );

    if (outcome.status === "signed-in") {
      router.replace(next);
      router.refresh();
      return; // keep the button disabled while the page changes
    }

    setPending(false);
    if (outcome.status === "needs-confirmation") {
      setNotice(
        "Account created. Check your inbox for a confirmation link, then sign in.",
      );
      return;
    }
    setError(outcome.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={copy.passwordAutoComplete}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={mode === "sign-up" ? "password-hint" : undefined}
          required
        />
        {mode === "sign-up" && (
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
          {error.includes("Sign in instead") && (
            <>
              {" "}
              <Link href={switchHref} className="font-medium underline">
                Go to sign in
              </Link>
            </>
          )}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-md border bg-muted px-3 py-2 text-sm"
        >
          {notice}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? copy.pending : copy.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {copy.switchText}{" "}
        <Link
          href={switchHref}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </form>
  );
}
