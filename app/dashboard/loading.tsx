export default function DashboardLoading() {
  return (
    <div className="min-h-screen" aria-busy="true" aria-live="polite">
      <div className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <span className="sr-only">Loading your dashboard…</span>
      </div>
    </div>
  );
}
