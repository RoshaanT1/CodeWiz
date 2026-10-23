import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { makeParseCheck } from "./plant-bugs";

describe("makeParseCheck", () => {
  it("accepts valid changed code and rejects broken code", async () => {
    const original = "function f(a) {\n  return a < 1;\n}";
    const check = makeParseCheck(original);
    expect(await check("function f(a) {\n  return a <= 1;\n}", "javascript")).toBe(true);
    expect(await check("function f(a) {\n  return a <= ;\n}", "javascript")).toBe(false);
  });

  it("checks an extracted JS class method inside a class wrapper", async () => {
    const original = "  async load(id) {\n    return await this.db.get(id);\n  }";
    const check = makeParseCheck(original);
    expect(await check("  async load(id) {\n    return this.db.get(id);\n  }", "typescript")).toBe(true);
    expect(await check("  async load(id) {\n    return this.db.get(id;\n  }", "typescript")).toBe(false);
  });

  it("checks an indented Python method after dedenting", async () => {
    const original = "    def add(self, x, items=None):\n        return items or [x]";
    const check = makeParseCheck(original);
    expect(await check("    def add(self, x, items=[]):\n        return items or [x]", "python")).toBe(true);
    expect(await check("    def add(self, x, items=[]:\n        return items or [x]", "python")).toBe(false);
  });
});
