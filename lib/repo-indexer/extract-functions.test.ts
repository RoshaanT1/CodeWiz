import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { extractFunctions } from "./extract-functions";
import type { ExtractedFunction, SupportedLanguage } from "./types";

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

async function run(
  name: string,
  filePath: string,
  language: SupportedLanguage,
): Promise<ExtractedFunction[]> {
  const result = await extractFunctions({
    filePath,
    language,
    source: fixture(name),
  });
  if (!result.ok) throw new Error(result.reason);
  return result.data;
}

function summary(list: ExtractedFunction[]) {
  return list.map((f) => [f.qualifiedName, f.startLine, f.endLine]);
}

describe("extractFunctions", () => {
  it("JavaScript: functions, arrows, expressions and methods", async () => {
    const list = await run("sample.js.fixture", "src/sample.js", "javascript");
    expect(summary(list)).toEqual([
      ["topLevel", 2, 4],
      ["arrow", 6, 8],
      ["expr", 10, 12],
      ["Greeter.greet", 15, 17],
      ["Greeter.create", 19, 21],
    ]);
    const arrow = list.find((f) => f.name === "arrow");
    expect(arrow?.code.startsWith("export const arrow")).toBe(true);
    expect(arrow?.code.endsWith("};")).toBe(true);
    expect(arrow?.filePath).toBe("src/sample.js");
    expect(arrow?.language).toBe("javascript");
  });

  it("TypeScript: class methods, fields and typed functions", async () => {
    const list = await run("sample.ts.fixture", "lib/sample.ts", "typescript");
    expect(summary(list)).toEqual([
      ["Circle.constructor", 8, 10],
      ["Circle.area", 12, 14],
      ["Circle.handler", 16, 18],
      ["load", 21, 23],
      ["helper", 25, 25],
    ]);
  });

  it("TSX: component arrow, nested function and default export", async () => {
    const list = await run("sample.tsx.fixture", "ui/sample.tsx", "tsx");
    expect(summary(list)).toEqual([
      ["Button", 3, 8],
      ["Button.onClick", 4, 6],
      ["Page", 10, 12],
    ]);
  });

  it("Python: defs, methods, decorators, nested defs and lambdas", async () => {
    const list = await run("sample.py.fixture", "app/sample.py", "python");
    expect(summary(list)).toEqual([
      ["top", 4, 5],
      ["Greeter.greet", 9, 10],
      ["Greeter.create", 12, 14],
      ["Greeter.load", 16, 19],
      ["Greeter.load.inner", 17, 18],
      ["square", 22, 22],
    ]);
    const create = list.find((f) => f.name === "create");
    expect(create?.code.startsWith("@staticmethod")).toBe(true);
  });

  it("detects the language from the file extension", async () => {
    const result = await extractFunctions({
      filePath: "a/b.py",
      source: "def hi():\n    return 1\n",
    });
    expect(result.ok && result.data[0]?.language).toBe("python");
  });

  it("rejects unsupported files with a reason", async () => {
    const result = await extractFunctions({ filePath: "a.rb", source: "" });
    expect(result.ok).toBe(false);
  });
});
