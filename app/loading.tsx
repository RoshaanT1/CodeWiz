export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-5 pb-16 text-center" role="status">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute h-12 w-12 animate-ping rounded-full bg-primary/20" />
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Loading...</p>
        <p className="text-xs text-muted-foreground">
          Fetching repository functions and session data
        </p>
      </div>
    </div>
  );
}
