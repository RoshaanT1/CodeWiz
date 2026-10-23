import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password · CodeWiz" };

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthCard mode="reset">
      <ResetPasswordForm />
    </AuthCard>
  );
}
