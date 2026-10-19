// Parses one source file with tree-sitter and lists its functions.
// Static analysis only: the code is parsed, never run.
// Portable: no imports from the app.

import Parser from "web-tree-sitter";

import { collectJsFunctions } from "./extract-js";
import { collectPythonFunctions } from "./extract-python";
import type { ExtractContext } from "./extract-shared";
import { detectLanguage } from "./languages";
import { loadLanguage } from "./parser-loader";
import type { ExtractedFunction, Result, SupportedLanguage } from "./types";

export type ExtractFunctionsInput = {
  filePath: string;
  source: string;
  /** Optional. Detected from the file extension when left out. */
  language?: SupportedLanguage;
};

export async function extractFunctions(
  input: ExtractFunctionsInput,
): Promise<Result<ExtractedFunction[]>> {
  const language = input.language ?? detectLanguage(input.filePath);
  if (!language) {
    return { ok: false, reason: `Unsupported file type: ${input.filePath}` };
  }

  const loaded = await loadLanguage(language);
  if (!loaded.ok) return loaded;

  const ctx: ExtractContext = { filePath: input.filePath, language, out: [] };
  let parser: Parser | null = null;
  try {
    parser = new Parser();
    parser.setLanguage(loaded.data);
    const tree = parser.parse(input.source);
    try {
      if (language === "python") collectPythonFunctions(tree.rootNode, ctx);
      else collectJsFunctions(tree.rootNode, ctx);
    } finally {
      tree.delete();
    }
    return { ok: true, data: ctx.out };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Couldn't parse ${input.filePath}: ${detail}` };
  } finally {
    parser?.delete();
  }
}
