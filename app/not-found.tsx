import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-4xl">
        🔍
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Page Not Found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          We couldn&apos;t find the repository, round, or page you were looking for.
          It may have been moved, deleted, or you might not have access to it.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/dashboard">Return to Dashboard</Link>
      </Button>
    </div>
  );
}
