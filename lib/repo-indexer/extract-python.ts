// Finds functions in Python syntax trees: def (sync and async), methods,
// and `name = lambda ...` assignments. Lambdas used as arguments are skipped.

import {
  walk,
  type Described,
  type ExtractContext,
  type Node,
} from "./extract-shared";

function describe(node: Node): Described | null {
  switch (node.type) {
    case "function_definition": {
      const name = node.childForFieldName("name")?.text;
      if (!name) return null;
      // Include decorators in the reported code and line range.
      const range =
        node.parent?.type === "decorated_definition" ? node.parent : node;
      return { name, range, pushScope: true };
    }
    case "class_definition": {
      const name = node.childForFieldName("name")?.text;
      return name ? { name, range: null, pushScope: true } : null;
    }
    case "assignment": {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");
      if (left?.type === "identifier" && right?.type === "lambda") {
        return { name: left.text, range: node, pushScope: false };
      }
      return null;
    }
    default:
      return null;
  }
}

export function collectPythonFunctions(root: Node, ctx: ExtractContext): void {
  walk(root, [], ctx, describe);
}
