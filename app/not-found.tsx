import { SearchX } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/app-shell/page-parts";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="mx-auto flex w-full max-w-[1040px] items-center px-5 py-5">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col items-center justify-center gap-6 px-5 pb-16 pt-4 text-center md:pb-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-primary">
          <SearchX size={28} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Page Not Found</h1>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
            We couldn&apos;t find the repository, round, or page you were looking for.
            It may have been moved, deleted, or you might not have access to it.
          </p>
        </div>
        <Button asChild size="lg" className="w-full max-w-[280px] sm:w-auto">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </main>
    </div>
  );
}
