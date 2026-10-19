"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

type EnrolFactor = {
  factorId: string;
  secret: string;
  uri: string;
  qrCode: string;
};

type Props = {
  mode: "enrol" | "verify";
  next: string;
};

function codeMessage(error: unknown): string {
  const fallback = "That code didn't work. Check your authenticator app and try again.";
  if (!(error instanceof Error)) return fallback;
  const message = error.message.toLowerCase();
  if (message.includes("invalid") || message.includes("expired")) return fallback;
  return error.message;
}

function getVerifiedTotpFactorId(factors: unknown): string | null {
  if (!Array.isArray(factors)) return null;
  const match = factors.find((factor) => {
    if (typeof factor !== "object" || factor === null) return false;
    const data = factor as { factor_type?: unknown; status?: unknown; id?: unknown };
    return data.factor_type === "totp" && data.status === "verified" && typeof data.id === "string";
  });
  return typeof (match as { id?: unknown } | undefined)?.id === "string"
    ? ((match as { id: string }).id)
    : null;
}

export function TwoFactorForm({ mode, next }: Props) {
  const router = useRouter();
  const target = useMemo(() => safeNextPath(next), [next]);
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState<EnrolFactor | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const client = createClient();
      if (!client.ok) {
        setError(client.reason);
        setLoading(false);
        return;
      }

      try {
        const { data: userData, error: userError } = await client.data.auth.getUser();
        if (userError || !userData.user) {
          router.replace(`/sign-in?next=${encodeURIComponent(target)}`);
          return;
        }

        if (mode === "enrol") {
          const { data, error: enrollError } = await client.data.auth.mfa.enroll({
            factorType: "totp",
          });
          if (enrollError) throw enrollError;
          if (!cancelled) {
            setFactor({
              factorId: data.id,
              secret: data.totp.secret,
              uri: data.totp.uri,
              qrCode: data.totp.qr_code,
            });
          }
        }
      } catch (err) {
        if (!cancelled) setError(codeMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    prepare();
    return () => {
      cancelled = true;
    };
  }, [mode, router, target]);

  async function factorIdForVerify() {
    if (mode === "enrol") return factor?.factorId ?? null;
    const client = createClient();
    if (!client.ok) {
      setError(client.reason);
      return null;
    }
    const { data, error: factorsError } = await client.data.auth.mfa.listFactors();
    if (factorsError) {
      setError(codeMessage(factorsError));
      return null;
    }
    return getVerifiedTotpFactorId(data.totp);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setNotice(null);

    const trimmed = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    const client = createClient();
    if (!client.ok) {
      setError(client.reason);
      return;
    }

    setPending(true);
    try {
      const factorId = await factorIdForVerify();
      if (!factorId) {
        setError(
          mode === "enrol"
            ? "Start enrolment again, then enter the new 6-digit code."
            : "No verified authenticator app was found. Set up 2FA first.",
        );
        setPending(false);
        return;
      }
      const { error: verifyError } = await client.data.auth.mfa.challengeAndVerify({
        factorId,
        code: trimmed,
      });
      if (verifyError) throw verifyError;
      router.replace(target);
      router.refresh();
    } catch (err) {
      setError(codeMessage(err));
      setPending(false);
    }
  }

  async function onCancel() {
    const client = createClient();
    if (client.ok) await client.data.auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Preparing your 2FA check…</p>;

  return (
    <div className="space-y-4">
      {mode === "enrol" && factor && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="mx-auto w-fit rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: factor.qrCode }} />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Manual setup key</p>
            <p className="break-all rounded bg-background px-2 py-1 font-mono text-xs">{factor.secret}</p>
            <details className="text-xs text-muted-foreground">
              <summary>Show TOTP URI</summary>
              <p className="mt-1 break-all">{factor.uri}</p>
            </details>
          </div>
        </div>
      )}

      {notice && <p role="status" className="rounded-md border bg-muted px-3 py-2 text-sm">{notice}</p>}
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="totp-code">6-digit code</Label>
          <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} disabled={pending} required />
        </div>
        <Button type="submit" className="w-full" disabled={pending || (mode === "enrol" && !factor)}>
          {pending ? "Checking code…" : mode === "enrol" ? "Finish 2FA setup" : "Verify and continue"}
        </Button>
        {mode === "verify" && (
          <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => setNotice("Open your authenticator app and use the newest CodeWiz code. It refreshes every 30 seconds.")}>Resend / get a new code</Button>
        )}
        <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={onCancel}>Cancel and sign out</Button>
      </form>
    </div>
  );
}
