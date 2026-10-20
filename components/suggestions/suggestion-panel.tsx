import { Button } from "@/components/ui/button";
import type { Suggestion } from "@/lib/demo/mock-data";

type Props = {
  suggestion: Suggestion;
  reason: string;
  onReason: (value: string) => void;
  onVote: (verdict: "agree" | "disagree") => void;
};

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  practice: "Best practice",
  security: "Security",
  library: "Library",
};

export function SuggestionPanel({ suggestion, reason, onReason, onVote }: Props) {
  return (
    <div className="rounded-md border bg-card p-4" data-testid={`suggestion-card-${suggestion.id}`}>
      <div className="text-xs font-semibold">{KIND_LABEL[suggestion.kind]}</div>
      <p className="mt-3 min-h-14 text-sm leading-6 text-muted-foreground">{suggestion.detail}</p>
      {suggestion.docsUrl && (
        <a href={suggestion.docsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary">
          Reference documentation
        </a>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant={suggestion.verdict === "agree" ? "default" : "outline"}
          onClick={() => onVote("agree")}
          data-testid={`button-agree-${suggestion.id}`}
        >
          Agree
        </Button>
        <Button
          size="sm"
          variant={suggestion.verdict === "disagree" ? "default" : "outline"}
          onClick={() => onVote("disagree")}
          data-testid={`button-disagree-${suggestion.id}`}
        >
          Disagree
        </Button>
      </div>
      {suggestion.verdict === "disagree" && (
        <textarea
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          className="mt-3 min-h-16 w-full rounded border bg-background p-2 text-xs"
          placeholder="Why isn't this relevant?"
          data-testid={`input-suggestion-reason-${suggestion.id}`}
        />
      )}
    </div>
  );
}
