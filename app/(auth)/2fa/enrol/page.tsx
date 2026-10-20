import type { Metadata } from "next";

import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Set up 2FA · CodeWiz" };

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function TwoFactorEnrolPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <TwoFactorForm mode="enrol" next={safeNextPath(next)} />
  );
}
