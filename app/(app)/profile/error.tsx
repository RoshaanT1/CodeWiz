"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ResultsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[600px] py-20 text-center">
      <div className="font-mono text-xs text-destructive">SOMETHING WENT WRONG</div>
      <h1 className="mt-3 text-2xl font-semibold">Your results didn’t load</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.digest ? "We couldn't load your scores right now." : error.message} Try again, or go back to the dashboard.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/dashboard">
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
