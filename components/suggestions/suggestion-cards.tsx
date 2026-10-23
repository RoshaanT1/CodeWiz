"use client";

import { ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postJson, postOnce } from "@/lib/client/post-json";

type Suggestion = {
  id: string;
  kind: "practice" | "security" | "library";
  detail: string;
  library: { ecosystem: string; package: string; functionName: string; docsUrl: string } | null;
  verdict: "agree" | "disagree" | null;
  reason: string | null;
  reasonScore: number | null;
  feedback: string | null;
};

const KIND_LABEL = { practice: "Best practice", security: "Security", library: "Library" } as const;

/** SEC-4 and LIB-3: suggestion cards where the user agrees or disagrees and defends it (AI step J). */
export function SuggestionCards({ roundFunctionId, onDone }: { roundFunctionId: string; onDone: () => void }) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { verdict: "agree" | "disagree" | null; reason: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setItems(null);
    const res = await postOnce<{ suggestions: Suggestion[] }>(`/api/round-functions/${roundFunctionId}/suggestions`);
    if (res.ok) setItems(res.data.suggestions);
    else setLoadError(res.message);
  }, [roundFunctionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(item: Suggestion) {
    const draft = drafts[item.id];
    if (!draft?.verdict) return;
    setBusy(item.id);
    setSubmitError(null);
    const res = await postJson<{ verdict: "agree" | "disagree"; reason: string; reasonScore: number; feedback: string }>(
      `/api/suggestions/${item.id}/respond`,
      { verdict: draft.verdict, reason: draft.reason },
    );
    setBusy(null);
    if (!res.ok) {
      setSubmitError(res.message);
      return;
    }
    setItems((old) => old?.map((s) => (s.id === item.id ? { ...s, ...res.data } : s)) ?? null);
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-card p-5 text-sm" role="alert">
        <p className="font-medium">We couldn&apos;t load suggestions.</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RotateCcw size={14} /> Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={onDone}>
            Skip
          </Button>
        </div>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Checking for suggestions…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card p-5 text-sm" data-testid="suggestions-empty">
        <p className="font-medium">No suggestions for this function</p>
        <p className="mt-1 text-muted-foreground">Nothing here needs a library or a change worth debating.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onDone} data-testid="button-suggestions-continue">
          Continue
        </Button>
      </div>
    );
  }

  const allAnswered = items.every((s) => s.verdict !== null);
  return (
    <div className="space-y-4" data-testid="suggestion-cards">
      {items.map((item) => {
        const draft = drafts[item.id] ?? { verdict: null, reason: "" };
        return (
          <div key={item.id} className="rounded-md border bg-card p-4" data-testid={`suggestion-${item.id}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">AI-generated</span>
            </div>
            {item.library && (
              <p className="text-sm font-medium [overflow-wrap:anywhere]">
                Consider <code className="font-mono">{item.library.package}</code>
                {item.library.functionName && item.library.functionName !== item.library.package && (
                  <>
                    {" "}
                    (<code className="font-mono">{item.library.functionName}</code>)
                  </>
                )}
                <a href={item.library.docsUrl} target="_blank" rel="noreferrer noopener" className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Docs <ExternalLink size={11} />
                </a>
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">Verified on {item.library.ecosystem === "python_stdlib" ? "the Python standard library" : item.library.ecosystem}</span>
              </p>
            )}
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>

            {item.verdict === null ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["agree", "disagree"] as const).map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant={draft.verdict === v ? "default" : "outline"}
                      onClick={() => setDrafts((old) => ({ ...old, [item.id]: { ...draft, verdict: v } }))}
                    >
                      {v === "agree" ? "I'd switch" : "I'd keep my code"}
                    </Button>
                  ))}
                </div>
                <textarea
                  value={draft.reason}
                  onChange={(e) => setDrafts((old) => ({ ...old, [item.id]: { ...draft, reason: e.target.value } }))}
                  maxLength={2000}
                  placeholder="Why? A good reason can disagree and still score full marks."
                  className="mt-2 min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                />
                <Button className="mt-2" size="sm" disabled={!draft.verdict || busy !== null} onClick={() => void respond(item)}>
                  {busy === item.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Grading…
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </>
            ) : (
              <div className="mt-3 space-y-1 text-xs leading-5">
                <p>
                  You chose <strong>{item.verdict === "agree" ? "to switch" : "to keep your code"}</strong>
                  {item.reasonScore !== null && <span className="ml-2 font-mono text-primary">{item.reasonScore}/2</span>}
                </p>
                {item.reason && <p className="rounded bg-muted p-2">{item.reason}</p>}
                {item.feedback && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">AI feedback:</span> {item.feedback}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
      {submitError && (
        <p className="text-xs text-destructive" role="alert">
          {submitError}
        </p>
      )}
      {allAnswered && (
        <Button onClick={onDone} data-testid="button-suggestions-continue">
          Continue
        </Button>
      )}
    </div>
  );
}
