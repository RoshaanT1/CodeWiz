"use client";

import { ArrowRight, Check, Clipboard, Command, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/** Supabase returns the QR code as raw SVG or as an SVG data URL. */
function qrCodeSrc(qrCode: string): string {
  return qrCode.startsWith("data:")
    ? qrCode
    : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
}

export function TwoFactorForm({ mode, next }: Props) {
  const router = useRouter();
  const target = useMemo(() => safeNextPath(next), [next]);
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState<EnrolFactor | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
          const { data: existingFactors } = await client.data.auth.mfa.listFactors();
          const verified = getVerifiedTotpFactorId(existingFactors?.totp);
          if (verified) {
            router.replace(`/2fa/verify?next=${encodeURIComponent(target)}`);
            return;
          }

          if (existingFactors?.all) {
            for (const f of existingFactors.all) {
              if (f.status === "unverified") {
                await client.data.auth.mfa.unenroll({ factorId: f.id });
              }
            }
          }

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

  async function copySecret() {
    if (!factor) return;
    try {
      await navigator.clipboard.writeText(factor.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access is unavailable. Select and copy the setup key instead.");
    }
  }

  const setup = mode === "enrol";
  const codeInput = (
    <Input
      id="totp-code"
      value={code}
      onChange={(e) => {
        setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
        setError(null);
      }}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="000000"
      className="mt-2 font-mono tracking-[.35em]"
      disabled={pending}
      data-testid="input-2fa-code"
    />
  );

  return (
    <div className="min-h-[100dvh]">
      <header className="mx-auto flex max-w-[1200px] px-5 py-5">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Command size={15} />
          </span>
          codewiz
        </Link>
      </header>
      <main className="mx-auto mt-9 max-w-md px-5">
        <div className="rounded-lg border bg-card p-6 sm:p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
            {setup ? <ShieldCheck size={19} /> : <Command size={19} />}
          </div>
          <h1 className="mt-5 text-xl font-semibold">
            {setup ? "Set up two-factor authentication" : "Verify it’s you"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {setup
              ? "Scan the QR code with your authenticator app, then enter the six-digit code to protect your account."
              : "Enter the six-digit code from your authenticator app to continue."}
          </p>

          {loading ? (
            <p role="status" className="mt-5 animate-pulse text-sm text-muted-foreground">
              Preparing your 2FA check…
            </p>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              {setup && factor && (
                <>
                  <div className="my-5 rounded-md border bg-muted/30 p-4">
                    <div className="text-xs font-semibold">Authenticator QR code</div>
                    <div
                      className="mt-3 flex justify-center rounded-md border bg-white p-4"
                      data-testid="qr-code-visual"
                      aria-label="QR code for your authenticator app"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCodeSrc(factor.qrCode)} alt="QR code for your authenticator app" className="h-36 w-36" />
                    </div>
                    <p className="mt-2 text-center text-[10px] text-muted-foreground">
                      Can’t scan it? Enter the setup key below instead.
                    </p>
                  </div>
                  <label className="block text-xs font-medium">Setup key</label>
                  <div className="mt-2 flex gap-2">
                    <code
                      className="flex flex-1 items-center break-all rounded-md border bg-muted/40 px-3 font-mono text-xs tracking-wider"
                      data-testid="text-setup-secret"
                    >
                      {factor.secret}
                    </code>
                    <Button type="button" variant="outline" onClick={copySecret} aria-label="Copy setup key" data-testid="button-copy-secret">
                      {copied ? <Check size={14} /> : <Clipboard size={14} />}
                      <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                  {copied && (
                    <p className="mt-1 text-xs text-primary" data-testid="status-secret-copied">
                      Setup key copied.
                    </p>
                  )}
                </>
              )}
              <label htmlFor="totp-code" className="mt-5 block text-xs font-medium">
                {setup ? "Six-digit confirmation code" : "Verification code"}
                {codeInput}
              </label>
              {error && (
                <p className="mt-2 text-xs text-destructive" role="alert" data-testid="status-2fa-error">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="mt-4 w-full"
                disabled={pending || code.length !== 6 || (setup && !factor)}
                data-testid={setup ? "button-setup-2fa" : "button-verify-2fa"}
              >
                {pending ? (
                  "Checking code…"
                ) : setup ? (
                  <>
                    Confirm setup <Check size={14} />
                  </>
                ) : (
                  <>
                    Verify and continue <ArrowRight size={14} />
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
                data-testid="button-back-signin"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
