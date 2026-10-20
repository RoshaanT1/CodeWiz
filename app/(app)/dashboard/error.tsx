"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[600px] py-20 text-center">
      <div className="font-mono text-xs text-destructive">SOMETHING WENT WRONG</div>
      <h1 className="mt-3 text-2xl font-semibold">The dashboard didn’t load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong while loading your workspace. Try again, or go back
        to the home page.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
      </div>
    </div>
  );
}
