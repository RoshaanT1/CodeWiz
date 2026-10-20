export type PlanterLanguage = "python" | "javascript" | "typescript" | "tsx";

/** The bug catalogue from docs/ARCHITECTURE.md. Every change is made in place. */
export const BUG_CATALOGUE = {
  off_by_one: {
    description: "Boundary error",
    example: "A loop condition changes from < to <=",
    languages: "all",
  },
  wrong_condition: {
    description: "Wrong or inverted condition",
    example: "and becomes or, or > becomes <",
    languages: "all",
  },
  missing_guard: {
    description: "A null or empty check that no longer works",
    example: "A guard's condition changes so it never triggers",
    languages: "all",
  },
  wrong_variable: {
    description: "Wrong variable or argument",
    example: "Two arguments swap places",
    languages: "all",
  },
  swallowed_error: {
    description: "An error caught and ignored",
    example: "An error handler stops re-raising",
    languages: "all",
  },
  wrong_return: {
    description: "Wrong value returned",
    example: "Returns the input instead of the result",
    languages: "all",
  },
  unchecked_input: {
    description: "Validation that no longer protects (security)",
    example: "A validation check is weakened so bad input passes",
    languages: "all",
  },
  async_mistake: {
    description: "Missing await or an unhandled promise",
    example: "An await is dropped from a call on the same line",
    languages: ["javascript", "typescript", "tsx"],
  },
  mutable_default: {
    description: "Shared mutable default argument",
    example: "A default changes from None to []",
    languages: ["python"],
  },
} as const satisfies Record<
  string,
  { description: string; example: string; languages: "all" | readonly PlanterLanguage[] }
>;

export type BugType = keyof typeof BUG_CATALOGUE;

export const BUG_TYPES = Object.keys(BUG_CATALOGUE) as BugType[];

export function isBugType(value: string): value is BugType {
  return Object.hasOwn(BUG_CATALOGUE, value);
}

/** Bug types from the catalogue that apply to a language. */
export function bugTypesForLanguage(language: PlanterLanguage): BugType[] {
  return BUG_TYPES.filter((type) => {
    const languages: "all" | readonly PlanterLanguage[] = BUG_CATALOGUE[type].languages;
    return languages === "all" || languages.includes(language);
  });
}

/**
 * Splits the allowed bug types into preferred (the user's weak spots) and the
 * rest, so the prompt can weight planting toward what the user tends to miss.
 * Unknown or language-incompatible weak spots are ignored.
 */
export function weightBugTypes(
  allowed: readonly BugType[],
  weakBugTypes: readonly string[] = [],
): { preferred: BugType[]; others: BugType[] } {
  const weak = new Set(weakBugTypes);
  return {
    preferred: allowed.filter((type) => weak.has(type)),
    others: allowed.filter((type) => !weak.has(type)),
  };
}
