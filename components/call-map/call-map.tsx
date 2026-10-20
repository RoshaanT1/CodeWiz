import { ArrowDown, ArrowRight, CircleDot } from "lucide-react";

import type { Call, Fn } from "@/lib/demo/mock-data";

type Props = {
  functions: Fn[];
  calls: Call[];
  activeId: string;
  onSelect: (id: string) => void;
};

/** One-hop list of the selected function's callers and callees. No data fetching. */
export function CallMap({ functions, calls, activeId, onSelect }: Props) {
  const connected = new Set(
    calls.flatMap((c) =>
      c.callerId === activeId ? [c.calleeId] : c.calleeId === activeId ? [c.callerId] : [],
    ),
  );
  const active = functions.find((f) => f.id === activeId);
  return (
    <div className="rounded-md border bg-card p-4" data-testid="call-map">
      <div className="mb-3 text-xs font-medium text-muted-foreground">CALL RELATIONSHIPS</div>
      <button
        onClick={() => onSelect(activeId)}
        className="flex w-full items-center gap-2 rounded border border-primary/30 bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground"
      >
        <CircleDot size={14} />
        {active?.qualifiedName ?? activeId}
        <span className="ml-auto text-xs">selected</span>
      </button>
      <div className="my-2 flex items-center justify-center text-muted-foreground">
        <ArrowDown size={15} />
      </div>
      <div className="grid gap-1">
        {functions
          .filter((f) => connected.has(f.id))
          .map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f.id)}
              className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-muted"
              data-testid={`call-neighbor-${f.id}`}
            >
              <ArrowRight size={13} className="text-muted-foreground" />
              <span>{f.qualifiedName}</span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">{f.file}</span>
            </button>
          ))}
        {!connected.size && (
          <p className="py-2 text-xs text-muted-foreground">No neighboring functions found.</p>
        )}
      </div>
    </div>
  );
}
