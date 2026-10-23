import { Flag } from "lucide-react";

import type { Fn } from "@/lib/demo/mock-data";

type Props = {
  fn: Fn;
  code: string;
  selectedLine: number | null;
  flaggedLines: number[];
  onSelect: (line: number) => void;
};

/** The drill copy of a function. Click a line to select it. Changed lines are not marked: finding them is the exercise. */
export function ChangedCode({ fn, code, selectedLine, flaggedLines, onSelect }: Props) {
  return (
    <div className="overflow-auto rounded-md border bg-card font-mono text-xs leading-6" data-testid="changed-code-viewer">
      {code.split("\n").map((line, i) => {
        const number = fn.startLine + i;
        return (
          <div
            key={i}
            onClick={() => onSelect(number)}
            className={`flex min-w-max cursor-pointer ${selectedLine === number ? "bg-amber-100 dark:bg-amber-900/30" : "hover:bg-muted"}`}
            data-testid={`changed-code-line-${number}`}
          >
            <span className="sticky left-0 flex w-14 shrink-0 items-center justify-end gap-1 border-r bg-card/90 px-2 text-muted-foreground">
              {flaggedLines.includes(number) && <Flag size={11} className="text-amber-600" />}
              {number}
            </span>
            <code className="whitespace-pre px-3">{line}</code>
          </div>
        );
      })}
    </div>
  );
}
