import { describe, expect, it } from "vitest";

import { extractCallsFromFile, resolveCalls } from "./extract-calls";
import { extractFunctions } from "./extract-functions";
import { indexSourceFiles } from "./index";
import {
  categorizeFunction,
  computeImportanceScore,
  countBranches,
} from "./metrics";

describe("repo-indexer full pipeline", () => {
  const sampleJs = `
function helper(x) {
  if (x > 0) {
    return x * 2;
  }
  return 0;
}

function dataFetcher(url) {
  return fetch(url);
}

export function main() {
  const a = helper(5);
  const b = helper(10);
  const c = helper(15);
  dataFetcher("https://api.example.com");
  return a + b + c;
}
`;

  it("extracts calls and resolves callers/callees correctly", async () => {
    const fnsResult = await extractFunctions({
      filePath: "src/index.js",
      source: sampleJs,
      language: "javascript",
    });

    expect(fnsResult.ok).toBe(true);
    if (!fnsResult.ok) return;

    const rawCalls = await extractCallsFromFile(
      "src/index.js",
      sampleJs,
      fnsResult.data,
    );

    // main calls helper and dataFetcher
    expect(rawCalls.some((c) => c.calleeName === "helper")).toBe(true);
    expect(rawCalls.some((c) => c.calleeName === "dataFetcher")).toBe(true);

    const resolved = resolveCalls(rawCalls, fnsResult.data);
    expect(resolved.length).toBeGreaterThanOrEqual(2);

    const helperEdge = resolved.find((r) => r.calleeName === "helper");
    expect(helperEdge).toBeDefined();
    expect(helperEdge?.callerName).toBe("main");
  });

  it("counts branches properly with tree-sitter", async () => {
    const codeWithBranches = `
function test(a, b) {
  if (a > 0 && b > 0) {
    for (let i = 0; i < 5; i++) {
      console.log(i);
    }
  } else if (a < 0) {
    return -1;
  }
  return 0;
}
`;
    const count = await countBranches(codeWithBranches, "javascript");
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it("calculates importance scores according to contract", () => {
    // 3 * ln(1 + callers) + 2 * data_access + min(branches, 10)/10 + 0.5 * ln(1 + callees)
    const score = computeImportanceScore(3, 2, true, 4);
    // callers=3: 3*ln(4) ~= 4.1589
    // dataAccess=true: 2
    // branches=4: 0.4
    // callees=2: 0.5*ln(3) ~= 0.5493
    // Total ~= 7.1082
    expect(score).toBeCloseTo(7.1082, 2);
  });

  it("categorizes functions in strict contract priority order", () => {
    const mockFn = {
      name: "GET",
      qualifiedName: "GET",
      language: "typescript" as const,
      filePath: "app/api/route.ts",
      startLine: 1,
      endLine: 10,
      code: "export function GET() {}",
    };

    // Entry category priority
    expect(categorizeFunction(mockFn, 0, false)).toBe("entry");

    // Data category priority (has dataAccess)
    const helperWithData = { ...mockFn, name: "fetchUsers", filePath: "lib/db.ts" };
    expect(categorizeFunction(helperWithData, 1, true)).toBe("data");

    // Core category priority (>= 3 callers)
    const coreFn = { ...mockFn, name: "calc", filePath: "lib/calc.ts" };
    expect(categorizeFunction(coreFn, 3, false)).toBe("core");

    // Helper category
    expect(categorizeFunction(coreFn, 1, false)).toBe("helper");
  });

  it("indexes source files completely into files, functions, and call graph", async () => {
    const indexResult = await indexSourceFiles({
      owner: "test-owner",
      name: "test-repo",
      files: [
        {
          path: "src/index.js",
          source: sampleJs,
        },
      ],
    });

    expect(indexResult.ok).toBe(true);
    if (!indexResult.ok) return;

    const { files, functions, calls, truncated } = indexResult.data;
    expect(files).toEqual(["src/index.js"]);
    expect(truncated).toBe(false);

    // Verify all 3 functions exist
    const names = functions.map((f) => f.name);
    expect(names).toContain("helper");
    expect(names).toContain("dataFetcher");
    expect(names).toContain("main");

    // Verify metrics on main
    const mainFn = functions.find((f) => f.name === "main");
    expect(mainFn).toBeDefined();
    expect(mainFn?.category).toBe("entry");
    expect(mainFn?.metrics.callees).toBeGreaterThanOrEqual(2);

    // Verify data category on dataFetcher
    const dataFn = functions.find((f) => f.name === "dataFetcher");
    expect(dataFn?.metrics.dataAccess).toBe(true);
    expect(dataFn?.category).toBe("data");

    // Verify call edges
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
