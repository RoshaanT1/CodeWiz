// First test: all four grammars must load with the pinned versions.
// If this fails, stop and report. Don't swap libraries.

import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  coreWasmPath,
  grammarPath,
  initParser,
  loadLanguage,
} from "./parser-loader";
import { SUPPORTED_LANGUAGES } from "./languages";

describe("parser loader", () => {
  it("finds tree-sitter.wasm and every grammar file on disk", () => {
    expect(existsSync(coreWasmPath())).toBe(true);
    for (const language of SUPPORTED_LANGUAGES) {
      expect(existsSync(grammarPath(language)), language).toBe(true);
    }
  });

  it("initialises web-tree-sitter", async () => {
    await expect(initParser()).resolves.toBeUndefined();
  });

  it.each(SUPPORTED_LANGUAGES)("loads the %s grammar", async (language) => {
    const result = await loadLanguage(language);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toBeDefined();
  });
});
