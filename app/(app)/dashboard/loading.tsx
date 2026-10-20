export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1040px]" aria-busy="true" aria-live="polite">
      <div className="mb-7 space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-9 h-40 animate-pulse rounded-md bg-muted" />
      <div className="h-32 animate-pulse rounded-md bg-muted" />
      <span className="sr-only">Loading your dashboard…</span>
    </div>
  );
}
