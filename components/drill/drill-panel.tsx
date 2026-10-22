"use client";

import { Flag, Loader2, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DrillResult } from "@/lib/grading/drill-result";

import { DrillResults } from "./drill-results";

type DrillView = {
  drillId: string;
  status: "ready" | "skipped" | "submitted";
  code: string | null;
  startLine: number;
  language: string;
  bugCount: number;
};

type DrillFlag = { line: number; comment: string };

type Props = {
  roundFunctionId: string;
  /** Called once the drill is graded, or skipped, so the round can move on. */
  onDone?: (result: DrillResult | null) => void;
};

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

async function postJson<T>(url: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json()) as ApiResponse<T>;
    return json.ok ? { ok: true, data: json.data } : { ok: false, message: json.error.message };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

const flagsKey = (drillId: string) => `codewiz:drill-flags:${drillId}`;

function loadFlags(drillId: string): DrillFlag[] {
  try {
    const raw = window.localStorage.getItem(flagsKey(drillId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is DrillFlag =>
        typeof f === "object" && f !== null && typeof (f as DrillFlag).line === "number" && typeof (f as DrillFlag).comment === "string",
    );
  } catch {
    return [];
  }
}

function saveFlags(drillId: string, flags: DrillFlag[]) {
  try {
    window.localStorage.setItem(flagsKey(drillId), JSON.stringify(flags));
  } catch {
    // Private windows can block storage; flags then only last until reload.
  }
}

/**
 * DRILL-4: loads (or creates) the drill for one round function, lets the user
 * flag lines with a reason, then submits and shows the graded result.
 * Changed lines are never highlighted: finding them is the exercise.
 */
export function DrillPanel({ roundFunctionId, onDone }: Props) {
  const [drill, setDrill] = useState<DrillView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flags, setFlags] = useState<DrillFlag[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<DrillResult | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setDrill(null);
    const res = await postJson<DrillView>(`/api/round-functions/${roundFunctionId}/drill`);
    if (!res.ok) {
      setLoadError(res.message);
      return;
    }
    setDrill(res.data);
    setFlags(loadFlags(res.data.drillId));
    if (res.data.status === "submitted") {
      const graded = await postJson<DrillResult>(`/api/drills/${res.data.drillId}/submit`, { flags: [] });
      if (graded.ok) setResult(graded.data);
      else setLoadError(graded.message);
    }
  }, [roundFunctionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFlags(next: DrillFlag[]) {
    setFlags(next);
    if (drill) saveFlags(drill.drillId, next);
  }

  function selectLine(line: number) {
    const index = flags.findIndex((f) => f.line === line);
    setSelectedLine(line);
    setEditing(index >= 0 ? index : null);
    setComment(index >= 0 ? (flags[index]?.comment ?? "") : "");
  }

  function saveFlag() {
    if (selectedLine === null) return;
    const flag = { line: selectedLine, comment: comment.trim() };
    const next =
      editing !== null ? flags.map((f, i) => (i === editing ? flag : f)) : [...flags, flag].sort((a, b) => a.line - b.line);
    updateFlags(next);
    setSelectedLine(null);
    setEditing(null);
    setComment("");
  }

  function removeFlag(index: number) {
    updateFlags(flags.filter((_, i) => i !== index));
    if (editing === index) {
      setSelectedLine(null);
      setEditing(null);
      setComment("");
    }
  }

  async function submit() {
    if (!drill) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await postJson<DrillResult>(`/api/drills/${drill.drillId}/submit`, { flags });
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(res.message);
      return;
    }
    try {
      window.localStorage.removeItem(flagsKey(drill.drillId));
    } catch {
      // Nothing to clean up if storage is blocked.
    }
    setResult(res.data);
    onDone?.(res.data);
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-card p-5 text-sm" role="alert" data-testid="drill-error">
        <p className="font-medium">We couldn&apos;t load this drill.</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()} data-testid="button-retry-drill">
          <RotateCcw size={14} /> Try again
        </Button>
      </div>
    );
  }

  if (!drill) {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-card p-5 text-sm text-muted-foreground" data-testid="drill-loading">
        <Loader2 size={16} className="animate-spin" />
        Planting bugs in a copy of this function and checking each one. This can take up to a minute.
      </div>
    );
  }

  if (drill.status === "skipped" || drill.code === null) {
    return (
      <div className="rounded-md border border-dashed bg-card p-5 text-sm" data-testid="drill-skipped">
        <p className="font-medium">No drill for this function</p>
        <p className="mt-1 text-muted-foreground">
          The AI couldn&apos;t plant bugs that passed every check, so this function has no drill. Your quiz still counts.
        </p>
        {onDone && (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => onDone(null)} data-testid="button-skip-drill">
            Continue
          </Button>
        )}
      </div>
    );
  }

  if (result) return <DrillResults result={result} />;

  const lines = drill.code.split("\n");
  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_0.75fr]" data-testid="drill-panel">
      <section className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Find {drill.bugCount} planted bug{drill.bugCount === 1 ? "" : "s"} · click a line to flag it
          </h2>
          <Badge variant="outline">
            <Flag size={12} className="mr-1" />
            {flags.length} flag{flags.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <div className="overflow-auto rounded-md border bg-card font-mono text-xs leading-6" data-testid="drill-code">
          {lines.map((line, i) => {
            const number = drill.startLine + i;
            const flagged = flags.some((f) => f.line === number);
            return (
              <button
                type="button"
                key={number}
                onClick={() => selectLine(number)}
                className={`flex w-full min-w-max text-left ${selectedLine === number ? "bg-amber-100 dark:bg-amber-900/30" : "hover:bg-muted"}`}
                aria-label={`Line ${number}${flagged ? ", flagged" : ""}`}
                data-testid={`drill-line-${number}`}
              >
                <span className="sticky left-0 flex w-14 shrink-0 items-center justify-end gap-1 border-r bg-card/90 px-2 text-muted-foreground">
                  {flagged && <Flag size={11} className="text-amber-600" />}
                  {number}
                </span>
                <code className="whitespace-pre px-3">{line}</code>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The bugs were planted by AI on existing lines, so line numbers match the original file.
        </p>
      </section>

      <aside className="space-y-3">
        <div className="rounded-md border bg-card p-4">
          <h3 className="text-sm font-semibold">{editing !== null ? "Edit flag" : "Add a flag"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedLine === null ? "Click a line in the code first." : `Line ${selectedLine}`}
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={selectedLine === null}
            maxLength={1000}
            placeholder="What goes wrong on this line, and for which input?"
            className="mt-3 min-h-20 w-full rounded-md border bg-background p-3 text-sm disabled:opacity-50"
            data-testid="input-flag-comment"
          />
          <Button className="mt-2 w-full" onClick={saveFlag} disabled={selectedLine === null} data-testid="button-save-flag">
            {editing !== null ? "Save changes" : "Save flag"}
          </Button>
        </div>

        {flags.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            No flags yet. Flags are saved in this browser until you submit.
          </p>
        ) : (
          flags.map((f, i) => (
            <div key={f.line} className="rounded-md border bg-card p-3" data-testid={`drill-flag-${i}`}>
              <div className="flex items-center justify-between text-xs font-medium">
                <button type="button" onClick={() => selectLine(f.line)} className="hover:underline">
                  Line {f.line}
                </button>
                <button type="button" onClick={() => removeFlag(i)} aria-label={`Remove flag on line ${f.line}`} data-testid={`button-remove-flag-${i}`}>
                  <X size={13} />
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {f.comment || <em>No reason given yet</em>}
              </p>
            </div>
          ))
        )}

        {submitError && (
          <p className="text-xs text-destructive" role="alert">
            {submitError}
          </p>
        )}
        <Button className="w-full" onClick={() => void submit()} disabled={submitting} data-testid="button-submit-drill">
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Grading your flags…
            </>
          ) : (
            "Submit drill"
          )}
        </Button>
      </aside>
    </div>
  );
}
