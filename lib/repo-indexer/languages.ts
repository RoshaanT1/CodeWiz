// Maps file paths to the languages we can parse.
// Pure and portable: no imports from the app.

import type { SupportedLanguage } from "./types";

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  "python",
  "javascript",
  "typescript",
  "tsx",
];

const EXTENSIONS: Readonly<Record<string, SupportedLanguage>> = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
};

/** Language for a file path, or null when we can't parse it. */
export function detectLanguage(path: string): SupportedLanguage | null {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  return EXTENSIONS[name.slice(dot + 1)] ?? null;
}

/** True for parseable source files, minus type declarations and minified bundles. */
export function isSupportedSourcePath(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.endsWith(".d.ts") || lower.endsWith(".d.mts") || lower.endsWith(".d.cts")) {
    return false;
  }
  if (/\.min\.[cm]?js$/.test(lower)) return false;
  return detectLanguage(path) !== null;
}
