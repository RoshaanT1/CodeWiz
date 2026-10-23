import { buildConfirmBehaviourPrompt } from "./behaviour-prompt";
import { ConfirmBehaviourOutputSchema } from "./behaviour-schema";
import type { PlanterLanguage } from "./catalogue";
import type { PlantedBug } from "./check";
import type { PlanterLlm } from "./types";

export type ConfirmBehaviourOptions = {
  original: string;
  changedCode: string;
  startLine: number;
  language: PlanterLanguage;
  bugs: readonly PlantedBug[];
  llm: PlanterLlm;
};

export type ConfirmBehaviourResult =
  | { ok: true; changedCode: string; bugs: PlantedBug[]; dropped: number }
  | { ok: false; reason: string };

/**
 * AI step E: keeps only the bugs the model confirms change behaviour, and
 * restores the original lines of any dropped bug so the diff still matches
 * the answer key exactly.
 */
export async function confirmBehaviour(options: ConfirmBehaviourOptions): Promise<ConfirmBehaviourResult> {
  const { original, changedCode, startLine, language, bugs, llm } = options;
  const { systemPrompt, prompt } = buildConfirmBehaviourPrompt({ original, changedCode, startLine, language, bugs });
  const response = await llm({ systemPrompt, prompt, schema: ConfirmBehaviourOutputSchema });
  if (!response.ok) {
    return { ok: false, reason: `Behaviour check failed: ${response.reason}` };
  }
  if (response.data.bugs.length !== bugs.length) {
    return {
      ok: false,
      reason: `Behaviour check returned ${response.data.bugs.length} verdicts for ${bugs.length} bugs.`,
    };
  }

  const originalLines = original.split("\n");
  const lines = changedCode.split("\n");
  const kept: PlantedBug[] = [];
  bugs.forEach((bug, idx) => {
    if (response.data.bugs[idx].changes_behaviour) {
      kept.push(bug);
      return;
    }
    for (let line = bug.lineStart; line <= bug.lineEnd; line++) {
      lines[line - startLine] = originalLines[line - startLine];
    }
  });

  return { ok: true, changedCode: lines.join("\n"), bugs: kept, dropped: bugs.length - kept.length };
}
