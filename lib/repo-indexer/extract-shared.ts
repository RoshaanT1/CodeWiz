// Small helpers shared by the per-language extractors.

import type Parser from "web-tree-sitter";

import type { ExtractedFunction, SupportedLanguage } from "./types";

export type Node = Parser.SyntaxNode;

export type ExtractContext = {
  filePath: string;
  language: SupportedLanguage;
  out: ExtractedFunction[];
};

/** Adds one function. `range` decides the code text and the line numbers. */
export function recordFunction(
  ctx: ExtractContext,
  scope: readonly string[],
  name: string,
  range: Node,
): void {
  ctx.out.push({
    name,
    qualifiedName: [...scope, name].join("."),
    language: ctx.language,
    filePath: ctx.filePath,
    startLine: range.startPosition.row + 1,
    endLine: range.endPosition.row + 1,
    code: range.text,
  });
}

/** What a node means for the walk. */
export type Described = {
  name: string;
  /** Node whose text and lines are reported; null when nothing is recorded. */
  range: Node | null;
  /** Names of anything nested inside get `name.` in front. */
  pushScope: boolean;
};

/** Generic pre-order walk: outer functions come before inner ones. */
export function walk(
  node: Node,
  scope: readonly string[],
  ctx: ExtractContext,
  describe: (node: Node) => Described | null,
): void {
  let childScope = scope;
  const found = describe(node);
  if (found) {
    if (found.range) recordFunction(ctx, scope, found.name, found.range);
    if (found.pushScope) childScope = [...scope, found.name];
  }
  for (const child of node.namedChildren) {
    walk(child, childScope, ctx, describe);
  }
}
