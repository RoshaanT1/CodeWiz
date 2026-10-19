import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sign in · CodeWiz" };

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <AuthCard
      title="Sign in"
      description="Use your email and password to open your dashboard."
    >
      <AuthForm mode="sign-in" next={safeNextPath(next)} />
    </AuthCard>
  );
}
