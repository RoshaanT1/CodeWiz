import type { z } from "zod";

import { buildLibrarySuggestionPrompt, type LibrarySuggestionInput } from "@/lib/ai/prompts/library-suggestion";
import { LibrarySuggestionSchema } from "@/lib/ai/schemas/library-suggestion";
import type { VerifyPackageOptions, VerifyPackageResult } from "@/lib/registry-verifier";

type Llm = <T>(request: {
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T>;
}) => Promise<{ ok: true; data: T } | { ok: false; reason: string }>;

export type LibrarySuggestion = {
  ecosystem: "npm" | "pypi" | "python_stdlib";
  package: string;
  functionName: string;
  /** From the registry, never from the model. */
  docsUrl: string;
  why: string;
};

/**
 * LIB-1: AI step H plus the LIB-2 registry check. Returns null when the model
 * has no suggestion or the suggestion can't be verified, so only real,
 * documented packages ever reach the user.
 */
export async function suggestLibrary(
  input: LibrarySuggestionInput,
  deps: { llm: Llm; verify: (options: VerifyPackageOptions) => Promise<VerifyPackageResult> },
): Promise<{ ok: true; data: LibrarySuggestion | null; dropped?: string } | { ok: false; reason: string }> {
  const { systemPrompt, prompt } = buildLibrarySuggestionPrompt(input);
  const response = await deps.llm({ systemPrompt, prompt, schema: LibrarySuggestionSchema });
  if (!response.ok) return { ok: false, reason: response.reason };

  const suggestion = response.data.suggestion;
  if (!suggestion) return { ok: true, data: null };

  const python = input.language === "python";
  if (python === (suggestion.ecosystem === "npm")) {
    return { ok: true, data: null, dropped: `${suggestion.ecosystem} doesn't fit ${input.language}` };
  }

  const verified = await deps.verify({ ecosystem: suggestion.ecosystem, package: suggestion.package, functionName: suggestion.function });
  if (!verified.exists) return { ok: true, data: null, dropped: verified.reason ?? `${suggestion.package} doesn't exist` };
  if (!verified.mentionedInDocs || !verified.docsUrl) {
    return {
      ok: true,
      data: null,
      dropped: `${suggestion.package} doesn't document ${suggestion.function}`,
    };
  }

  return {
    ok: true,
    data: {
      ecosystem: suggestion.ecosystem,
      package: suggestion.package,
      functionName: suggestion.function,
      docsUrl: verified.docsUrl,
      why: suggestion.why,
    },
  };
}
