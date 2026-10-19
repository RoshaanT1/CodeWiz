import type { Metadata } from "next";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { RepoPreview } from "@/components/repo-preview/repo-preview";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard · CodeWiz" };

// Always render per request: the page depends on the session cookie.
export const dynamic = "force-dynamic";

function formatDate(value: string | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export default async function DashboardPage() {
  // Server-side check on top of the middleware: signed-out visitors are sent
  // to the sign-in page before any dashboard content is rendered.
  const user = await requireUser("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            CodeWiz
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="hidden max-w-[16rem] truncate text-sm text-muted-foreground sm:inline"
              title={user.email ?? undefined}
            >
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            You&apos;re signed in as {user.email}.
          </p>
        </div>

        <RepoPreview />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your account</CardTitle>
            <CardDescription>
              Details of the account you&apos;re signed in with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all font-medium">{user.email}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground">Account created</dt>
                <dd className="font-medium">{formatDate(user.created_at)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd className="font-medium">
                  {formatDate(user.last_sign_in_at)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
