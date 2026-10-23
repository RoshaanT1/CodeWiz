"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeResetError, validateNewPassword } from "@/lib/auth/password-reset";
import { DEFAULT_AFTER_SIGN_IN } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "expired" }
  /** factorId is set when the account has 2FA and this session hasn't passed it yet. */
  | { kind: "ready"; email: string; factorId: string | null };

/**
 * AUTH-5: sets a new password for the user signed in by the reset link. With
 * 2FA on, the authenticator code comes first, so someone with only the email
 * can't take over the account.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const client = createClient();
      if (!client.ok) return setState({ kind: "expired" });
      const { data: userData } = await client.data.auth.getUser();
      if (!userData.user) return !cancelled && setState({ kind: "expired" });
      const { data: aal } = await client.data.auth.mfa.getAuthenticatorAssuranceLevel();
      let factorId: string | null = null;
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const { data: factors } = await client.data.auth.mfa.listFactors();
        factorId = factors?.totp.find((f) => f.status === "verified")?.id ?? null;
      }
      if (!cancelled) setState({ kind: "ready", email: userData.user.email ?? "", factorId });
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || state.kind !== "ready") return;
    setError(null);
    const digits = code.replace(/\s/g, "");
    if (state.factorId && !/^\d{6}$/.test(digits)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    const invalid = validateNewPassword(password, confirm);
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
    if (state.factorId) {
      const { error: codeError } = await client.data.auth.mfa.challengeAndVerify({ factorId: state.factorId, code: digits });
      if (codeError) {
        setPending(false);
        setError("That code didn't work. Check your authenticator app and try again.");
        return;
      }
      setState({ ...state, factorId: null });
    }
    const { error: updateError } = await client.data.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError(describeResetError(updateError));
      return;
    }
    router.replace(DEFAULT_AFTER_SIGN_IN);
    router.refresh();
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card p-6 text-sm text-muted-foreground sm:p-8" role="status">
        <Loader2 size={16} className="animate-spin" /> Checking your reset link…
      </div>
    );
  }

  if (state.kind === "expired") {
    return (
      <div className="rounded-lg border bg-card p-6 sm:p-8" data-testid="status-reset-link-missing">
        <h2 className="text-xl font-semibold">This link has expired</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Reset links work once, for one hour. Request a new one and use the latest email.</p>
        <Button asChild className="mt-5 w-full">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border bg-card p-6 sm:p-8" data-testid="form-reset-password">
      <div className="text-center">
        <div className="font-mono text-[11px] uppercase tracking-wider text-primary">Account recovery</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Set a new password</h2>
        <p className="mt-1 break-all text-sm text-muted-foreground">For {state.email}</p>
      </div>
      {state.factorId && (
        <label className="mt-4 block text-xs font-medium">
          Code from your authenticator app
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, "").slice(0, 7))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123 456"
            disabled={pending}
            className="mt-1.5 font-mono tracking-widest"
            data-testid="input-reset-code"
          />
        </label>
      )}
      <label className="mt-4 block text-xs font-medium">
        New password
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          disabled={pending}
          className="mt-1.5"
          data-testid="input-new-password"
        />
      </label>
      <label className="mt-4 block text-xs font-medium">
        Confirm new password
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={pending}
          className="mt-1.5"
          data-testid="input-confirm-password"
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive" data-testid="status-reset-error">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-5 w-full" disabled={pending} data-testid="button-save-password">
        {pending ? "Saving…" : "Save new password"} <ArrowRight size={14} />
      </Button>
    </form>
  );
}
