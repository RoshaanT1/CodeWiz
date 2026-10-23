import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password · CodeWiz" };

type Props = { searchParams: Promise<{ expired?: string | string[] }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { expired } = await searchParams;
  return (
    <AuthCard mode="forgot">
      <ForgotPasswordForm expired={expired === "1"} />
    </AuthCard>
  );
}
