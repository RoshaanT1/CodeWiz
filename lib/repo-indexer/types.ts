// Shared types for parsing. No imports from the app.

export type SupportedLanguage = "python" | "javascript" | "typescript" | "tsx";

export type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

/** One function, method or variable-assigned function found in a file. */
export type ExtractedFunction = {
  /** Plain name, e.g. `greet`. */
  name: string;
  /** Name with enclosing classes/functions, e.g. `Greeter.greet`. */
  qualifiedName: string;
  language: SupportedLanguage;
  filePath: string;
  /** 1-based line of the first line of `code`. */
  startLine: number;
  /** 1-based line of the last line of `code`. */
  endLine: number;
  /**
   * Source text of the function. For `const f = () => {}` this is the whole
   * declaration (with `export` if present); for a decorated Python function
   * it includes the decorators.
   */
  code: string;
};
