import { callJson } from "@/lib/ai/call-json";
import { buildSelectFunctionsPrompt } from "@/lib/ai/prompts/select-functions";
import {
  SelectFunctionsOutputSchema,
  type SelectFunctionPick,
} from "@/lib/ai/schemas/select-functions";
import {
  rankCandidates,
  type FunctionCandidate,
  type FunctionCategory,
} from "./rank";

export type SelectFunctionsOptions = {
  candidates: FunctionCandidate[];
  roundSize?: number;
  weakBugTypes?: string[];
  apiKey?: string;
};

export type SelectFunctionsResult = {
  ok: true;
  picks: SelectFunctionPick[];
  usedAi: boolean;
  attempts: number;
};

/**
 * Deterministically selects functions from ranked candidates with category spread.
 * Used as a zero-failure fallback if the LLM is down or fails schema checks.
 */
export function fallbackSelectFunctions(
  candidates: FunctionCandidate[],
  roundSize: number,
): SelectFunctionPick[] {
  const ranked = rankCandidates(candidates, 15);
  const targetCount = Math.min(roundSize, ranked.length);

  const categories: FunctionCategory[] = ["entry", "data", "core", "helper"];
  const chosen: FunctionCandidate[] = [];
  const chosenIds = new Set<string>();

  // 1. One pass: try to pick the top function from each available category
  for (const cat of categories) {
    if (chosen.length >= targetCount) break;
    const candidate = ranked.find(
      (c) => c.category === cat && !chosenIds.has(c.id),
    );
    if (candidate) {
      chosen.push(candidate);
      chosenIds.add(candidate.id);
    }
  }

  // 2. Fill remaining slots with the highest importance candidates
  for (const candidate of ranked) {
    if (chosen.length >= targetCount) break;
    if (!chosenIds.has(candidate.id)) {
      chosen.push(candidate);
      chosenIds.add(candidate.id);
    }
  }

  return chosen.map((c) => ({
    function_id: c.id,
    reason: `Selected as a high-impact ${c.category} function with ${c.callers} callers and ${c.branches} branch points.`,
  }));
}

/**
 * Validates the AI model picks against strict CodeWiz Step A rules:
 * - All IDs exist in candidate list
 * - No duplicate IDs
 * - Count matches requested round size
 */
export function validatePicks(
  picks: SelectFunctionPick[],
  candidates: FunctionCandidate[],
  expectedCount: number,
): boolean {
  if (picks.length !== expectedCount) return false;

  const validIds = new Set(candidates.map((c) => c.id));
  const seenIds = new Set<string>();

  for (const pick of picks) {
    if (!validIds.has(pick.function_id)) return false;
    if (seenIds.has(pick.function_id)) return false;
    seenIds.add(pick.function_id);
  }

  return true;
}

/**
 * AI Step A: Select functions orchestrator.
 * Ranks candidates, prompts LLM for diverse educational picks, verifies against
 * contracts, and gracefully falls back to deterministic heuristics if AI fails.
 */
export async function selectFunctions(
  options: SelectFunctionsOptions,
): Promise<SelectFunctionsResult> {
  const { candidates, roundSize = 5, weakBugTypes, apiKey } = options;

  const rankedCandidates = rankCandidates(candidates, 15);
  const targetCount = Math.min(roundSize, rankedCandidates.length);

  if (targetCount === 0) {
    return { ok: true, picks: [], usedAi: false, attempts: 0 };
  }

  const { systemPrompt, prompt } = buildSelectFunctionsPrompt({
    candidates: rankedCandidates,
    roundSize: targetCount,
    weakBugTypes,
  });

  const aiResult = await callJson({
    prompt,
    systemPrompt,
    schema: SelectFunctionsOutputSchema,
    temperature: 0.3,
    apiKey,
  });

  if (aiResult.ok) {
    const isValid = validatePicks(aiResult.data.picks, rankedCandidates, targetCount);
    if (isValid) {
      return {
        ok: true,
        picks: aiResult.data.picks,
        usedAi: true,
        attempts: aiResult.attempts,
      };
    }
  }

  // Graceful deterministic fallback
  const fallbackPicks = fallbackSelectFunctions(rankedCandidates, targetCount);
  return {
    ok: true,
    picks: fallbackPicks,
    usedAi: false,
    attempts: aiResult.ok ? aiResult.attempts : 2,
  };
}
