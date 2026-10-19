export type FunctionCategory = "entry" | "core" | "data" | "helper";

export type FunctionCandidate = {
  id: string;
  name: string;
  qualifiedName: string;
  file: string;
  language: string;
  startLine: number;
  endLine: number;
  length: number;
  branches: number;
  callers: number;
  callees: number;
  dataAccess: boolean;
  category: FunctionCategory;
  importance?: number;
  excluded?: boolean;
  explained?: boolean;
  code?: string;
  signature?: string;
};

/**
 * Calculates the function importance score per CodeWiz contract:
 * score = 3 * ln(1 + callers) + 2 * data_access + min(branches, 10) / 10 + 0.5 * ln(1 + callees)
 */
export function computeImportance(candidate: {
  callers: number;
  callees: number;
  dataAccess: boolean;
  branches: number;
}): number {
  const callersPart = 3 * Math.log(1 + Math.max(0, candidate.callers));
  const dataAccessPart = 2 * (candidate.dataAccess ? 1 : 0);
  const branchesPart = Math.min(Math.max(0, candidate.branches), 10) / 10;
  const calleesPart = 0.5 * Math.log(1 + Math.max(0, candidate.callees));
  return Number((callersPart + dataAccessPart + branchesPart + calleesPart).toFixed(4));
}

/**
 * Checks if a function is eligible for quiz/drill rounds per CodeWiz rules:
 * - Length >= 5 lines
 * - Not trivial (must have branches or calls)
 * - Not previously reviewed or explained
 * - Excludes test files, vendor, dist, and build outputs
 */
export function isEligibleCandidate(fn: FunctionCandidate): boolean {
  if (fn.excluded || fn.explained) return false;
  if (fn.length < 5) return false;
  if (fn.branches === 0 && fn.callers === 0 && fn.callees === 0) return false;

  const normalized = fn.file.replace(/\\/g, "/").toLowerCase();
  const skippedPatterns = [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/.next/",
    "/vendor/",
    "/__tests__/",
    "/__pycache__/",
    ".test.",
    ".spec.",
    "test_",
    "_test.",
  ];

  if (skippedPatterns.some((pattern) => normalized.includes(pattern))) {
    return false;
  }

  return true;
}

/**
 * Filters and ranks eligible candidates by importance score descending,
 * returning the top N candidates (default 15) for the AI selection step.
 */
export function rankCandidates(
  candidates: FunctionCandidate[],
  limit = 15,
): FunctionCandidate[] {
  return candidates
    .filter(isEligibleCandidate)
    .map((c) => ({
      ...c,
      importance: c.importance ?? computeImportance(c),
    }))
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, limit);
}
