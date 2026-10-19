// Computes function metrics, categories and importance scores.
// Implements CodeWiz contracts from docs/ARCHITECTURE.md.
// Pure and portable: no app imports.

import Parser from "web-tree-sitter";

import type { RawCall, ResolvedCall } from "./extract-calls";
import { loadLanguage } from "./parser-loader";
import type { ExtractedFunction, SupportedLanguage } from "./types";

export type FunctionCategory = "entry" | "data" | "core" | "helper";

export type FunctionMetrics = {
  length: number;
  branches: number;
  callers: number;
  callees: number;
  dataAccess: boolean;
};

export type IndexedFunction = ExtractedFunction & {
  id: string;
  metrics: FunctionMetrics;
  category: FunctionCategory;
  importance: number;
};

type Node = Parser.SyntaxNode;

const JS_BRANCH_NODES = new Set([
  "if_statement",
  "switch_case",
  "for_statement",
  "for_in_statement",
  "for_of_statement",
  "while_statement",
  "do_statement",
  "catch_clause",
  "ternary_expression",
]);

const PY_BRANCH_NODES = new Set([
  "if_statement",
  "elif_clause",
  "for_statement",
  "while_statement",
  "except_clause",
  "conditional_expression",
]);

const DATA_ACCESS_KEYWORDS = [
  "fetch",
  "axios",
  "requests",
  "open(",
  "fs.",
  "readFile",
  "writeFile",
  "read_file",
  "write_file",
  "prisma",
  "supabase",
  "pool.query",
  "db.query",
  "client.query",
  "cursor.execute",
  "sqlite3",
  "pg",
  "httpx",
  "aiohttp",
  "createClient",
  "urllib",
  "http.client",
];

const ENTRY_NAMES = new Set([
  "main",
  "run",
  "handler",
  "start",
  "cli",
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "head",
  "options",
]);

function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return lang === "python" || lang === "javascript" || lang === "typescript" || lang === "tsx";
}

/**
 * Counts AST decision branches in a function's code.
 */
export async function countBranches(
  code: string,
  language: string,
): Promise<number> {
  if (!isSupportedLanguage(language)) {
    const matches = code.match(/\b(if|else\s+if|for|while|switch|case|catch|&&|\|\|)\b/g);
    return matches ? matches.length : 0;
  }

  const loaded = await loadLanguage(language);
  if (!loaded.ok) {
    // Fallback regex estimation if parser unavailable
    const matches = code.match(/\b(if|else\s+if|for|while|switch|case|catch|&&|\|\|)\b/g);
    return matches ? matches.length : 0;
  }

  let parser: Parser | null = null;
  let count = 0;

  try {
    parser = new Parser();
    parser.setLanguage(loaded.data);
    const tree = parser.parse(code);

    try {
      function visit(node: Node): void {
        if (language === "python") {
          if (PY_BRANCH_NODES.has(node.type)) count += 1;
          if (node.type === "boolean_operator") count += 1;
        } else {
          if (JS_BRANCH_NODES.has(node.type)) count += 1;
          if (
            node.type === "binary_expression" &&
            (node.child(1)?.text === "&&" ||
              node.child(1)?.text === "||" ||
              node.child(1)?.text === "??")
          ) {
            count += 1;
          }
        }
        for (const child of node.namedChildren) {
          visit(child);
        }
      }

      visit(tree.rootNode);
    } finally {
      tree.delete();
    }
  } catch {
    // Return whatever count was reached
  } finally {
    parser?.delete();
  }

  return count;
}

/**
 * Checks whether a function interacts with external databases, network, or file I/O.
 */
export function checkDataAccess(
  fn: ExtractedFunction,
  rawCalls: readonly RawCall[],
): boolean {
  const code = fn.code;
  for (const kw of DATA_ACCESS_KEYWORDS) {
    if (code.includes(kw)) return true;
  }

  const fnId = `${fn.filePath}#${fn.qualifiedName}`;
  for (const call of rawCalls) {
    if (call.callerId === fnId) {
      const target = call.calleeRaw.toLowerCase();
      if (
        target.includes("fetch") ||
        target.includes("query") ||
        target.includes("request") ||
        target.includes("read") ||
        target.includes("write") ||
        target.includes("post") ||
        target.includes("get")
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Categorizes a function according to CodeWiz contract order:
 * 1. entry: 0 callers in repo, and matches route/cli/main conventions
 * 2. data: dataAccess === true
 * 3. core: 3 or more callers
 * 4. helper: everything else
 */
export function categorizeFunction(
  fn: ExtractedFunction,
  callersCount: number,
  dataAccess: boolean,
): FunctionCategory {
  if (callersCount === 0) {
    const lowerName = fn.name.toLowerCase();
    const lowerPath = fn.filePath.toLowerCase();
    const isEntryName = ENTRY_NAMES.has(lowerName);
    const isEntryPath =
      lowerPath.includes("/api/") ||
      lowerPath.includes("/routes/") ||
      lowerPath.includes("route.ts") ||
      lowerPath.includes("route.js") ||
      lowerPath.includes("pages/") ||
      lowerPath.includes("cli.") ||
      lowerPath.includes("main.py") ||
      lowerPath.includes("app.py") ||
      lowerPath.includes("index.") ||
      lowerPath.includes("server.");

    if (isEntryName || isEntryPath) {
      return "entry";
    }
  }

  if (dataAccess) return "data";
  if (callersCount >= 3) return "core";
  return "helper";
}

/**
 * Importance formula from docs/ARCHITECTURE.md:
 * score = 3 * ln(1 + callers) + 2 * (dataAccess ? 1 : 0) + min(branches, 10) / 10 + 0.5 * ln(1 + callees)
 */
export function computeImportanceScore(
  callers: number,
  callees: number,
  dataAccess: boolean,
  branches: number,
): number {
  const callersPart = 3 * Math.log(1 + Math.max(0, callers));
  const dataAccessPart = 2 * (dataAccess ? 1 : 0);
  const branchesPart = Math.min(Math.max(0, branches), 10) / 10;
  const calleesPart = 0.5 * Math.log(1 + Math.max(0, callees));
  return Number((callersPart + dataAccessPart + branchesPart + calleesPart).toFixed(4));
}

/**
 * Computes all metrics, categories, and importance scores for a list of extracted functions.
 */
export async function computeAllMetrics(
  functions: readonly ExtractedFunction[],
  rawCalls: readonly RawCall[],
  resolvedCalls: readonly ResolvedCall[],
): Promise<IndexedFunction[]> {
  // Count callers and callees per function ID
  const callersMap = new Map<string, number>();
  const calleesMap = new Map<string, number>();

  for (const call of resolvedCalls) {
    calleesMap.set(call.callerId, (calleesMap.get(call.callerId) ?? 0) + 1);
    callersMap.set(call.calleeId, (callersMap.get(call.calleeId) ?? 0) + 1);
  }

  const results: IndexedFunction[] = [];

  for (const fn of functions) {
    const id = `${fn.filePath}#${fn.qualifiedName}`;
    const length = Math.max(1, fn.endLine - fn.startLine + 1);
    const branches = await countBranches(fn.code, fn.language);
    const callers = callersMap.get(id) ?? 0;
    const callees = calleesMap.get(id) ?? 0;
    const dataAccess = checkDataAccess(fn, rawCalls);
    const category = categorizeFunction(fn, callers, dataAccess);
    const importance = computeImportanceScore(callers, callees, dataAccess, branches);

    results.push({
      ...fn,
      id,
      metrics: {
        length,
        branches,
        callers,
        callees,
        dataAccess,
      },
      category,
      importance,
    });
  }

  return results;
}
