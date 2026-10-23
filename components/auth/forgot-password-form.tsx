"use client";

import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { createClient } from "@/lib/supabase/client";

/** AUTH-5: asks for an email address and sends the reset link. */
export function ForgotPasswordForm({ expired }: { expired: boolean }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter the email address you signed up with.");
      return;
    }
    const client = createClient();
    if (!client.ok) {
      setError(client.reason);
      return;
    }
    setPending(true);
    const result = await requestPasswordReset(client.data, trimmed, window.location.origin);
    setPending(false);
    if (result.ok) setSentTo(trimmed);
    else setError(result.message);
  }

  if (sentTo) {
    return (
      <div className="rounded-lg border bg-card p-6 sm:p-8" role="status" data-testid="status-reset-sent">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
          <MailCheck size={20} />
        </div>
        <h2 className="text-xl font-semibold">Check your inbox</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, we&apos;ve sent a link to choose a new password. It works for one hour. Check your spam folder if it doesn&apos;t arrive in a few minutes.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setSentTo(null)}>
            Use another email
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border bg-card p-6 sm:p-8">
      <div className="font-mono text-[11px] uppercase tracking-wider text-primary">Account recovery</div>
      <h2 className="mt-2 text-xl font-semibold">Forgot your password?</h2>
      <p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      {expired && (
        <p role="alert" className="mt-4 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200" data-testid="status-reset-expired">
          That reset link has expired or was already used. Request a new one below.
        </p>
      )}
      <label className="mt-4 block text-xs font-medium">
        Email address
        <Input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          aria-invalid={error ? true : undefined}
          className="mt-1.5"
          data-testid="input-email"
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive" data-testid="status-reset-error">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-5 w-full" disabled={pending} data-testid="button-send-reset">
        {pending ? "Sending…" : "Send reset link"} <ArrowRight size={14} />
      </Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
