import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";

// The call to action depends on the session cookie, so render per request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSessionUser();
  const user = session.ok ? session.data : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">CodeWiz</h1>
      <p className="text-lg text-muted-foreground">
        Import a public GitHub repo, map its functions, and learn the important
        ones with quizzes and spot-the-bug drills.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {user ? (
          <Button asChild>
            <Link href="/dashboard">Go to your dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/sign-up">Create an account</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </>
        )}
        <Button asChild variant="ghost">
          <a
            href="https://github.com/RoshaanT1/CodeWiz"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </Button>
      </div>
    </main>
  );
}
