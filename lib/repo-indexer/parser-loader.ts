// Loads web-tree-sitter and the prebuilt .wasm grammars (Node.js only).
// Nothing here runs repo code: it only reads our own .wasm files from disk.
// Portable: no imports from the app.

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import Parser from "web-tree-sitter";

import type { Result, SupportedLanguage } from "./types";

/** File names inside `tree-sitter-wasms/out/`. */
export const GRAMMAR_FILES: Readonly<Record<SupportedLanguage, string>> = {
  python: "tree-sitter-python.wasm",
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
};

function packageDir(name: string): string {
  const root = process.cwd();
  try {
    const req = createRequire(path.join(root, "package.json"));
    return path.dirname(req.resolve(`${name}/package.json`));
  } catch {
    return path.join(root, "node_modules", name);
  }
}

/** web-tree-sitter's own runtime, needed next to the grammars. */
export function coreWasmPath(): string {
  return path.join(packageDir("web-tree-sitter"), "tree-sitter.wasm");
}

export function grammarPath(language: SupportedLanguage): string {
  return path.join(packageDir("tree-sitter-wasms"), "out", GRAMMAR_FILES[language]);
}

let initPromise: Promise<void> | null = null;

/** Calls `Parser.init` once, pointing it at tree-sitter.wasm. */
export function initParser(): Promise<void> {
  if (!initPromise) {
    const corePath = coreWasmPath();
    initPromise = Parser.init({
      locateFile(name: string) {
        return name === "tree-sitter.wasm" ? corePath : name;
      },
    }).catch((err: unknown) => {
      initPromise = null; // allow a retry
      throw err;
    });
  }
  return initPromise;
}

const languages = new Map<SupportedLanguage, Promise<Parser.Language>>();

/** Loads (and caches) one grammar. Fails with a readable reason. */
export async function loadLanguage(
  language: SupportedLanguage,
): Promise<Result<Parser.Language>> {
  try {
    await initParser();
    let pending = languages.get(language);
    if (!pending) {
      pending = readFile(grammarPath(language)).then((bytes) =>
        Parser.Language.load(new Uint8Array(bytes)),
      );
      languages.set(language, pending);
    }
    try {
      return { ok: true, data: await pending };
    } catch (err) {
      languages.delete(language);
      throw err;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `Couldn't load the ${language} grammar: ${detail}`,
    };
  }
}
