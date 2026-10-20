import { Flag } from "lucide-react";

import type { Fn } from "@/lib/demo/mock-data";

type Props = {
  fn: Fn;
  selectedLines: number[];
  onLineSelect?: (line: number) => void;
  flaggedLines?: number[];
  changedLines?: number[];
};

const KEYWORDS =
  "return|if|else|for|while|const|let|var|function|def|class|new|throw|try|catch|await|async|export|from|import|in|not|and|or|True|False|None";
const TOKEN = new RegExp(`(\\b(?:${KEYWORDS})\\b|"(?:[^"]*)"|'(?:[^']*)')`, "g");
const KEYWORD = new RegExp(`^(${KEYWORDS})$`);

/** Light keyword and string highlighting for one line of code. */
function highlight(line: string) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
    return <span className="syntax-comment">{line}</span>;
  }
  return line.split(TOKEN).map((part, i) =>
    part.startsWith('"') || part.startsWith("'") ? (
      <span className="syntax-string" key={i}>
        {part}
      </span>
    ) : KEYWORD.test(part) ? (
      <span className="syntax-key" key={i}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function CodeViewer({
  fn,
  selectedLines,
  onLineSelect,
  flaggedLines = [],
  changedLines = [],
}: Props) {
  const lines = fn.code.split("\n");
  return (
    <div
      className="overflow-auto rounded-md border bg-card font-mono text-[12px] leading-6"
      data-testid={`code-viewer-${fn.id}`}
    >
      {lines.map((line, i) => {
        const n = fn.startLine + i;
        const selected = selectedLines.includes(n);
        const flagged = flaggedLines.includes(n);
        const changed = changedLines.includes(n);
        return (
          <div
            key={i}
            onClick={() => onLineSelect?.(n)}
            className={`code-line group flex min-w-max cursor-pointer ${selected ? "bg-amber-100/70 dark:bg-amber-900/20" : changed ? "bg-red-50 dark:bg-red-950/30" : ""}`}
            data-testid={`code-line-${n}`}
          >
            <span className="sticky left-0 flex w-12 shrink-0 items-center justify-end gap-2 border-r bg-card/95 px-2 text-right text-muted-foreground">
              {flagged && <Flag size={11} className="text-amber-600" />}
              {n}
            </span>
            <code className="whitespace-pre px-4 text-foreground">{highlight(line)}</code>
          </div>
        );
      })}
    </div>
  );
}
