import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Set up 2FA · CodeWiz" };

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function TwoFactorEnrolPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Set up two-factor authentication"
      description="Scan the QR code in your authenticator app, then enter the 6-digit code to protect your CodeWiz account."
    >
      <TwoFactorForm mode="enrol" next={safeNextPath(next)} />
    </AuthCard>
  );
}
