"use client";

import { CheckCircle2, GraduationCap, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/client/post-json";

type Message = { role: "tutor" | "user"; text: string };

type TutorTurn = { message: string; question: string | null; understood: boolean; done: boolean; triesLeft: number };

type Props = {
  drillId: string;
  lineStart: number;
  /** Missed bugs open the offer more prominently. */
  missed: boolean;
};

/**
 * DRILL-5: an AI tutor for one planted bug. It explains the bug, asks the user
 * to explain it back, and explains it another way until they get it.
 */
export function BugTutor({ drillId, lineStart, missed }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ understood: boolean } | null>(null);
  const [triesLeft, setTriesLeft] = useState(0);

  async function send(next: Message[]) {
    setBusy(true);
    setErr(null);
    const res = await postJson<TutorTurn>(`/api/drills/${drillId}/tutor`, { lineStart, history: next });
    setBusy(false);
    if (!res.ok) {
      setErr(res.message);
      return false;
    }
    // The question is kept with the tutor's message, so the next turn sees what was asked.
    const tutorText = res.data.question ? `${res.data.message}\n\n${res.data.question}` : res.data.message;
    setHistory([...next, { role: "tutor", text: tutorText }]);
    setQuestion(res.data.question);
    setTriesLeft(res.data.triesLeft);
    if (res.data.done) setDone({ understood: res.data.understood });
    return true;
  }

  function start() {
    setOpen(true);
    setHistory([]);
    setDone(null);
    setDraft("");
    void send([]);
  }

  async function answer() {
    const text = draft.trim();
    if (!text) return;
    const ok = await send([...history, { role: "user", text }]);
    if (ok) setDraft("");
  }

  if (!open) {
    return (
      <Button variant={missed ? "default" : "outline"} size="sm" onClick={start} data-testid={`button-tutor-${lineStart}`}>
        <GraduationCap size={14} /> {missed ? "Explain it to me" : "Go over it with the tutor"}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-primary/30 bg-background p-3" data-testid={`tutor-${lineStart}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <GraduationCap size={13} className="text-primary" /> Bug tutor · AI-generated
      </div>

      {history.map((m, i) =>
        m.role === "tutor" ? (
          <p key={i} className="whitespace-pre-line text-xs leading-5" data-testid="tutor-message">
            {m.text}
          </p>
        ) : (
          <p key={i} className="ml-auto max-w-[85%] whitespace-pre-line rounded-md bg-muted px-3 py-2 text-xs leading-5">
            {m.text}
          </p>
        ),
      )}

      {busy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={13} className="animate-spin" /> {history.length === 0 ? "Working out how to explain it…" : "Reading your answer…"}
        </p>
      )}
      {err && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-destructive" role="alert">
          {err}
          {history.length === 0 && (
            <Button variant="outline" size="sm" onClick={start}>
              <RotateCcw size={13} /> Try again
            </Button>
          )}
        </div>
      )}

      {done ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-md p-2.5 text-xs ${done.understood ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "bg-muted"}`}
          data-testid="tutor-done"
        >
          <span className="flex items-center gap-1.5 font-medium">
            {done.understood && <CheckCircle2 size={14} />}
            {done.understood ? "You've got it." : "That's the full answer. Read it once more, then try another drill."}
          </span>
          <Button variant="ghost" size="sm" onClick={start}>
            <RotateCcw size={13} /> Start over
          </Button>
        </div>
      ) : (
        question &&
        !busy && (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={1500}
              placeholder="Explain it back in your own words"
              className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void answer();
              }}
              data-testid={`input-tutor-${lineStart}`}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {triesLeft} {triesLeft === 1 ? "try" : "tries"} left
              </span>
              <Button size="sm" onClick={() => void answer()} disabled={!draft.trim()} data-testid={`button-tutor-send-${lineStart}`}>
                Check my answer
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
