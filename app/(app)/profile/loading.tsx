export default function Loading() {
  return (
    <div className="mx-auto max-w-[1040px]" aria-busy="true" aria-live="polite">
      <div className="mb-7 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-40 animate-pulse rounded-md bg-muted" />
      <span className="sr-only">Loading your results…</span>
    </div>
  );
}
