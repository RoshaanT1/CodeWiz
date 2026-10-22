import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { makeParseCheck } from "./plant-bugs";

describe("makeParseCheck", () => {
  it("accepts valid changed code and rejects broken code", async () => {
    const original = "function f(a) {\n  return a < 1;\n}";
    const check = makeParseCheck(original);
    expect((await check({ code: "function f(a) {\n  return a <= 1;\n}", language: "javascript" })).ok).toBe(true);
    expect((await check({ code: "function f(a) {\n  return a <= ;\n}", language: "javascript" })).ok).toBe(false);
  });

  it("checks an extracted JS class method inside a class wrapper", async () => {
    const original = "  async load(id) {\n    return await this.db.get(id);\n  }";
    const check = makeParseCheck(original);
    expect((await check({ code: "  async load(id) {\n    return this.db.get(id);\n  }", language: "typescript" })).ok).toBe(true);
    expect((await check({ code: "  async load(id) {\n    return this.db.get(id;\n  }", language: "typescript" })).ok).toBe(false);
  });

  it("checks an indented Python method after dedenting", async () => {
    const original = "    def add(self, x, items=None):\n        return items or [x]";
    const check = makeParseCheck(original);
    expect((await check({ code: "    def add(self, x, items=[]):\n        return items or [x]", language: "python" })).ok).toBe(true);
    expect((await check({ code: "    def add(self, x, items=[]:\n        return items or [x]", language: "python" })).ok).toBe(false);
  });
});
