// Collects call expressions inside functions and resolves approximate callers and callees.
// Static analysis only: code is parsed with tree-sitter, never executed.
// Self-contained and portable: no app imports.

import Parser from "web-tree-sitter";

import { detectLanguage } from "./languages";
import { loadLanguage } from "./parser-loader";
import type { ExtractedFunction } from "./types";

export type RawCall = {
  /** The function making the call. */
  callerId: string;
  callerFile: string;
  callerName: string;
  /** Raw callee identifier or property name, e.g. "fetch", "helper", "user.getName". */
  calleeRaw: string;
  /** Normalized simple name, e.g. "getName" from "user.getName()". */
  calleeName: string;
  /** Line number of the call expression. */
  line: number;
};

export type ResolvedCall = {
  callerId: string;
  callerFile: string;
  callerName: string;
  calleeId: string;
  calleeFile: string;
  calleeName: string;
};

type Node = Parser.SyntaxNode;

/**
 * Extracts raw function call identifiers from a single source file.
 */
export async function extractCallsFromFile(
  filePath: string,
  source: string,
  functionsInFile: ExtractedFunction[],
): Promise<RawCall[]> {
  const language = detectLanguage(filePath);
  if (!language || functionsInFile.length === 0) return [];

  const loaded = await loadLanguage(language);
  if (!loaded.ok) return [];

  let parser: Parser | null = null;
  const rawCalls: RawCall[] = [];

  try {
    parser = new Parser();
    parser.setLanguage(loaded.data);
    const tree = parser.parse(source);

    try {
      // Sort functions by startLine to find which function encloses each call
      const sortedFns = [...functionsInFile].sort(
        (a, b) => a.startLine - b.startLine,
      );

      function findEnclosingFunction(line: number): ExtractedFunction | null {
        // Find innermost function covering this line
        let match: ExtractedFunction | null = null;
        for (const fn of sortedFns) {
          if (line >= fn.startLine && line <= fn.endLine) {
            if (!match || (fn.endLine - fn.startLine < match.endLine - match.startLine)) {
              match = fn;
            }
          }
        }
        return match;
      }

      function visit(node: Node): void {
        const line = node.startPosition.row + 1;

        if (language === "python") {
          if (node.type === "call") {
            const funcNode = node.childForFieldName("function");
            if (funcNode) {
              const raw = funcNode.text;
              const calleeName = raw.includes(".")
                ? raw.slice(raw.lastIndexOf(".") + 1)
                : raw;
              const enclosing = findEnclosingFunction(line);
              if (enclosing && calleeName) {
                rawCalls.push({
                  callerId: `${enclosing.filePath}#${enclosing.qualifiedName}`,
                  callerFile: enclosing.filePath,
                  callerName: enclosing.qualifiedName,
                  calleeRaw: raw,
                  calleeName,
                  line,
                });
              }
            }
          }
        } else {
          // JS, TS, TSX
          if (node.type === "call_expression") {
            const funcNode = node.childForFieldName("function");
            if (funcNode) {
              const raw = funcNode.text;
              const calleeName = raw.includes(".")
                ? raw.slice(raw.lastIndexOf(".") + 1)
                : raw;
              const enclosing = findEnclosingFunction(line);
              if (enclosing && calleeName) {
                rawCalls.push({
                  callerId: `${enclosing.filePath}#${enclosing.qualifiedName}`,
                  callerFile: enclosing.filePath,
                  callerName: enclosing.qualifiedName,
                  calleeRaw: raw,
                  calleeName,
                  line,
                });
              }
            }
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
    // If parsing fails for a file, return what was collected so far
  } finally {
    parser?.delete();
  }

  return rawCalls;
}

/**
 * Resolves raw calls against the repository's indexed functions.
 * Per CodeWiz contract (docs/ARCHITECTURE.md):
 * 1. Same file first
 * 2. Unique name across the repo
 * 3. Skip ambiguous names to prevent false connections.
 */
export function resolveCalls(
  rawCalls: readonly RawCall[],
  allFunctions: readonly ExtractedFunction[],
): ResolvedCall[] {
  // Index functions by file + simple name, and by qualified name
  const byFileAndName = new Map<string, ExtractedFunction[]>();
  const byNameRepoWide = new Map<string, ExtractedFunction[]>();

  for (const fn of allFunctions) {
    const fileKey = `${fn.filePath}::${fn.name}`;
    const fileList = byFileAndName.get(fileKey);
    if (fileList) fileList.push(fn);
    else byFileAndName.set(fileKey, [fn]);

    // Also index qualified name
    const qualKey = `${fn.filePath}::${fn.qualifiedName}`;
    if (qualKey !== fileKey) {
      const qList = byFileAndName.get(qualKey);
      if (qList) qList.push(fn);
      else byFileAndName.set(qualKey, [fn]);
    }

    const repoList = byNameRepoWide.get(fn.name);
    if (repoList) repoList.push(fn);
    else byNameRepoWide.set(fn.name, [fn]);
  }

  const resolved: ResolvedCall[] = [];
  const seenEdges = new Set<string>();

  for (const call of rawCalls) {
    let target: ExtractedFunction | null = null;

    // 1. Same file match
    const sameFileMatch = byFileAndName.get(`${call.callerFile}::${call.calleeName}`);
    if (sameFileMatch && sameFileMatch.length === 1) {
      target = sameFileMatch[0];
    } else if (sameFileMatch && sameFileMatch.length > 1) {
      // Ambiguous within the same file, skip
      continue;
    } else {
      // 2. Unique name anywhere in the repo
      const repoMatches = byNameRepoWide.get(call.calleeName);
      if (repoMatches && repoMatches.length === 1) {
        target = repoMatches[0];
      }
    }

    if (target) {
      const calleeId = `${target.filePath}#${target.qualifiedName}`;
      // Skip self-recursion for call map clarity if preferred, or keep it:
      const edgeKey = `${call.callerId}->${calleeId}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        resolved.push({
          callerId: call.callerId,
          callerFile: call.callerFile,
          callerName: call.callerName,
          calleeId,
          calleeFile: target.filePath,
          calleeName: target.qualifiedName,
        });
      }
    }
  }

  return resolved;
}
