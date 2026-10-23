"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    eyebrow: "CodeWiz account",
    title: "Sign in",
    subtitle: "Continue your learning practice.",
    submit: "Sign in",
    pending: "Signing in…",
    switchText: "New to CodeWiz?",
    switchLabel: "Create an account",
    switchHref: "/sign-up",
    passwordAutoComplete: "current-password",
  },
  "sign-up": {
    eyebrow: "New workspace",
    title: "Create your account",
    subtitle: "Start with a private learning workspace.",
    submit: "Create account",
    pending: "Creating account…",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
    passwordAutoComplete: "new-password",
  },
} as const;

function Field({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        {aside}
      </div>
      <label className="block">
        <span className="sr-only">{label}</span>
        {children}
      </label>
    </div>
  );
}

export function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const copy = COPY[mode];
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
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

    if (isSignUp && !name.trim()) {
      setError("Enter your name.");
      return;
    }
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
      isSignUp ? name.trim() : undefined,
    );

    if (outcome.status === "signed-in") {
      router.replace(next);
      router.refresh();
      return; // keep the button disabled while the page changes
    }

    setPending(false);
    if (outcome.status === "needs-confirmation") {
      setNotice("Account created. Check your inbox for a confirmation link, then sign in.");
      return;
    }
    setError(outcome.message);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border bg-card p-6 sm:p-8">
      <div className="font-mono text-[11px] uppercase tracking-wider text-primary">{copy.eyebrow}</div>
      <h2 className="mt-2 text-xl font-semibold">{copy.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
      {isSignUp && (
        <Field label="Your name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Maya Chen"
            disabled={pending}
            data-testid="input-name"
          />
        </Field>
      )}
      <Field label="Email address">
        <Input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          aria-invalid={error ? true : undefined}
          data-testid="input-email"
        />
      </Field>
      <Field
        label="Password"
        aside={
          !isSignUp && (
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline" data-testid="link-forgot-password">
              Forgot password?
            </Link>
          )
        }
      >
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={copy.passwordAutoComplete}
          placeholder="At least 8 characters"
          disabled={pending}
          aria-invalid={error ? true : undefined}
          data-testid="input-password"
        />
      </Field>
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
          data-testid="status-auth-errors"
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
        </div>
      )}
      {notice && (
        <div role="status" className="mt-3 rounded-md border bg-muted/50 p-3 text-xs">
          {notice}
        </div>
      )}
      <Button type="submit" className="mt-5 w-full" disabled={pending} data-testid="button-auth-submit">
        {pending ? copy.pending : copy.submit} <ArrowRight size={14} />
      </Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {copy.switchText}{" "}
        <Link href={switchHref} className="font-medium text-primary hover:underline" data-testid="link-auth-switch">
          {copy.switchLabel}
        </Link>
      </p>
    </form>
  );
}
