# repo-indexer

Point it at a public GitHub repo and get every Python, JavaScript, TypeScript, and TSX function with exact line ranges, an approximate call graph, and simple code metrics. Built on `web-tree-sitter`. No cloning, no code execution.

Zero app dependencies: lifts out directly into any Node.js project.

## Public API

```ts
export type IndexRepoOptions = {
  url: string;
  token?: string;
  folder?: string;
  limits?: {
    maxFiles?: number;         // default: 400
    maxFileSize?: number;      // default: 200 KB
    parallelRequests?: number; // default: 8
  };
  signal?: AbortSignal;
};

export type IndexRepoOutput = {
  owner: string;
  name: string;
  commitSha: string;
  files: string[];
  functions: IndexedFunction[];
  calls: ResolvedCall[];
  skipped: Array<{ path: string; reason: string }>;
  truncated: boolean;
};

export function indexRepo(options: IndexRepoOptions): Promise<Result<IndexRepoOutput>>;
export function indexSourceFiles(options: IndexFilesOptions): Promise<Result<IndexRepoOutput>>;
```

Each `IndexedFunction` has:
- `id`: unique ID (`filePath#qualifiedName`)
- `filePath`, `name`, `qualifiedName` (`Class.method` or nested functions)
- `language`: `"python" | "javascript" | "typescript" | "tsx"`
- `startLine`, `endLine`: 1-based, inclusive
- `code`: source text of the function declaration
- `metrics`: `{ length, branches, callers, callees, dataAccess }`
- `category`: `"entry" | "data" | "core" | "helper"`
- `importance`: ranking score for prioritizing critical code

## Install

```bash
npm install web-tree-sitter@0.20.8 tree-sitter-wasms@0.1.11
```

Node.js 20 or later. Use the Node.js runtime, not Edge (tree-sitter loads `.wasm` files from disk).

## Setup

- In Next.js, add to `next.config.ts`:
  - `serverExternalPackages: ["web-tree-sitter"]`
  - `outputFileTracingIncludes` for routes using the indexer, including `tree-sitter.wasm` and grammar files.

## Usage

```ts
import { indexRepo } from "./index";

const result = await indexRepo({
  url: "https://github.com/expressjs/express",
  token: process.env.GITHUB_TOKEN, // optional, avoids rate limits
});

if (result.ok) {
  console.log(`Indexed ${result.data.functions.length} functions across ${result.data.files.length} files.`);
  for (const fn of result.data.functions.slice(0, 5)) {
    console.log(`- ${fn.qualifiedName} (${fn.category}): importance ${fn.importance}`);
  }
} else {
  console.error("Indexing failed:", result.reason);
}
```

## How It Works

1. **Tree & File Fetching**: Uses GitHub REST API with concurrency limits and file size caps. Files in `node_modules`, `dist`, `build`, `.next`, and binary files are automatically excluded.
2. **Function Extraction**: Uses `web-tree-sitter` AST traversal to capture named functions, class methods, variable-assigned arrows/functions, and Python lambdas.
3. **Call Resolution**: Detects function calls within each function body and resolves callee identifiers:
   - Same file first
   - Unique name across the repository
   - Skips ambiguous identifiers
4. **Metrics & Categories**:
   - `branches`: AST decision points (`if`, `switch`, loops, `catch`, ternaries)
   - `dataAccess`: flags database, network, or file operations
   - `category`: assigns `entry`, `data`, `core`, or `helper`
   - `importance`: computes weighted logarithmic priority score

## Tests

Run the test suite:
```bash
npm run test
```
Tests run offline using fixtures and mock source files, requiring no GitHub API tokens.

## Dependencies and Licences

- `web-tree-sitter` — MIT: https://github.com/tree-sitter/tree-sitter
- `tree-sitter-wasms` — MIT: https://github.com/SamSovereign/tree-sitter-wasms

## Contributors

Roshaan Tahir, M Hammad Khan, Fizzah Abdullah, Hammad Khan
