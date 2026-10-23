"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client error trace if in development
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-5 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert size={28} />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Something went wrong</h2>
        <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
          An unexpected error occurred while loading this page. Please try
          refreshing or head back to the dashboard.
        </p>
      </div>
      <div className="flex w-full max-w-[280px] flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
