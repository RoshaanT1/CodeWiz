# repo-indexer

Reads a public GitHub repo's file tree and file contents, and extracts its functions with tree-sitter. Static analysis only: repo code is parsed, never run. Nothing here imports from the app, so the folder can be lifted into any Node.js project.

Status: in progress. `indexRepo(options)` (PARSE-5) isn't built yet. These modules are the pieces it will use.

## Install

```bash
npm install web-tree-sitter@0.20.8 tree-sitter-wasms@0.1.11
```

Node.js 20 or later. Not for the Edge runtime: the loader reads `.wasm` files from disk.

## Setup

- `parser-loader.ts` calls `Parser.init` with `locateFile` pointing at web-tree-sitter's own `tree-sitter.wasm`, then reads grammars from `tree-sitter-wasms/out/`. Paths resolve from `process.cwd()`.
- In Next.js, add to `next.config.ts`:
  - `serverExternalPackages: ["web-tree-sitter"]`
  - `outputFileTracingIncludes` for each route that parses, listing `tree-sitter.wasm` and the four grammar files, so they ship in the deployed bundle.

## Usage

```ts
import { extractFunctions } from "./extract-functions";

const result = await extractFunctions({ filePath: "src/a.ts", source });
if (result.ok) {
  for (const fn of result.data) {
    console.log(fn.qualifiedName, fn.startLine, fn.endLine);
  }
}
```

Each function has `name`, `qualifiedName` (`Class.method`), `language`, `filePath`, `startLine`, `endLine` (1-based, inclusive) and `code`.

What counts: named function declarations, class methods, class fields holding functions, and arrow or function expressions assigned to a variable. Python also gets `name = lambda ...`. Anonymous callbacks are skipped. Nested named functions get a qualified name such as `Outer.inner`.

Other modules: `fetch-tree.ts` (file tree), `fetch-files.ts` (file text, with a parallel limit, a per-file size cap and one retry), `file-tree.ts` (filtering), `parse-repo-url.ts`, `languages.ts` (extension to language).

## Limits

Taken as parameters. Defaults follow `docs/ARCHITECTURE.md`: 8 parallel requests and 200 KB per file. GitHub marks very large trees as `truncated`, and `fetchDefaultBranchTree` passes that flag on.

## Tests

`npm run test` runs vitest. The first test (`parser-loader.test.ts`) loads all four grammars. Fixtures are in `fixtures/`. No live GitHub calls.

## Dependencies

| Package | Version | Licence |
|---|---|---|
| web-tree-sitter | 0.20.8 (pinned) | MIT |
| tree-sitter-wasms | 0.1.11 (pinned) | MIT |
| vitest (dev only) | ^2.1.8 | MIT |

The prebuilt grammars it bundles (tree-sitter-python, -javascript, -typescript) are MIT too.

## Contributors

M Hammad Khan
