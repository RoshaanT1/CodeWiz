// Finds functions in JavaScript, TypeScript and TSX syntax trees.
// Named functions, class methods, and function values assigned to variables
// or class fields. Anonymous callbacks are not recorded.

import {
  walk,
  type Described,
  type ExtractContext,
  type Node,
} from "./extract-shared";

const FUNCTION_VALUES = new Set([
  "arrow_function",
  "function",
  "function_expression",
  "generator_function",
]);
const FUNCTION_DECLARATIONS = new Set([
  "function_declaration",
  "generator_function_declaration",
]);
const CLASS_NODES = new Set([
  "class_declaration",
  "class",
  "abstract_class_declaration",
]);
const FIELD_NODES = new Set(["field_definition", "public_field_definition"]);
const DECLARATION_NODES = new Set(["lexical_declaration", "variable_declaration"]);

function nameOf(node: Node, ...fields: string[]): string | null {
  for (const field of fields) {
    const child = node.childForFieldName(field);
    if (child) return child.text;
  }
  return null;
}

/** Wrapping `export` statement, so reported code starts with `export`. */
function withExport(node: Node): Node {
  return node.parent?.type === "export_statement" ? node.parent : node;
}

/** For `const f = () => {}` report the whole statement when it is the only declarator. */
function declarationRange(declarator: Node): Node {
  const parent = declarator.parent;
  if (parent && DECLARATION_NODES.has(parent.type)) {
    const declarators = parent.namedChildren.filter(
      (c) => c.type === "variable_declarator",
    );
    if (declarators.length === 1) return withExport(parent);
  }
  return declarator;
}

function describe(node: Node): Described | null {
  const type = node.type;

  if (FUNCTION_DECLARATIONS.has(type)) {
    const name = nameOf(node, "name");
    return name ? { name, range: withExport(node), pushScope: true } : null;
  }

  if (type === "method_definition") {
    const name = nameOf(node, "name");
    return name ? { name, range: node, pushScope: true } : null;
  }

  if (FIELD_NODES.has(type)) {
    const name = nameOf(node, "property", "name");
    const value = node.childForFieldName("value");
    if (name && value && FUNCTION_VALUES.has(value.type)) {
      return { name, range: node, pushScope: true };
    }
    return null;
  }

  if (type === "variable_declarator") {
    const id = node.childForFieldName("name");
    const value = node.childForFieldName("value");
    if (!id || id.type !== "identifier" || !value) return null;
    if (FUNCTION_VALUES.has(value.type)) {
      return { name: id.text, range: declarationRange(node), pushScope: true };
    }
    if (CLASS_NODES.has(value.type)) {
      return { name: id.text, range: null, pushScope: true };
    }
    return null;
  }

  if (CLASS_NODES.has(type)) {
    const name = nameOf(node, "name");
    return name ? { name, range: null, pushScope: true } : null;
  }

  return null;
}

export function collectJsFunctions(root: Node, ctx: ExtractContext): void {
  walk(root, [], ctx, describe);
}
