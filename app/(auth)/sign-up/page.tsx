import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Create account · CodeWiz" };

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignUpPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <AuthCard mode="sign-up">
      <AuthForm mode="sign-up" next={safeNextPath(next)} />
    </AuthCard>
  );
}
