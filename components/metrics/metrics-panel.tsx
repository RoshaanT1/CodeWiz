import { describeMetrics, type FunctionMetrics } from "@/lib/scoring/describe-metrics";

/** MET-1: a function's size and connections, with what they mean. No score. */
export function MetricsPanel({ metrics }: { metrics: FunctionMetrics }) {
  const tiles: [string, string][] = [
    ["Lines", String(metrics.length)],
    ["Branches", String(metrics.branches)],
    ["Callers", String(metrics.callers)],
    ["Calls", String(metrics.callees)],
  ];
  return (
    <div className="mt-3 border-t pt-3" data-testid="metrics-panel">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded border bg-background px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="font-mono text-sm font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
        {describeMetrics(metrics).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
