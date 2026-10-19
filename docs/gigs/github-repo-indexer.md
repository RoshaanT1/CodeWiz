# GitHub Repo Indexer: functions, calls and metrics

## Description

Point it at a public GitHub repo and get every Python, JavaScript and TypeScript function with exact line ranges, a call graph and simple metrics. Uses tree-sitter. No cloning, no code execution.

## Skills

TypeScript, Node.js

## Custom tags

tree-sitter, Octokit, GitHub API, static analysis, call graph, code search

## What it does

- Inspects public GitHub repositories without cloning them locally.
- Traverses the file tree, filtering out binaries, vendor bundles, and build directories (`node_modules`, `dist`, `.next`).
- Uses `web-tree-sitter` WASM grammars to parse Python, JavaScript, TypeScript, and TSX files statically.
- Extracts named functions, class methods, variable-assigned arrow functions, and lambdas with exact start and end line ranges.
- Traces call expressions within function bodies and resolves callers and callees (same file first, then repository-wide unique names).
- Computes code complexity metrics: length in lines, decision branches, `data_access` detection, and an importance score.
- Categorizes each function into `entry`, `data`, `core`, or `helper`.
- Zero dependencies on application code or specific database schemas — drop it directly into any Node.js project.

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

## Install

```bash
npm install web-tree-sitter@0.20.8 tree-sitter-wasms@0.1.11
```

## Setup

For Next.js App Router, ensure tree-sitter's WASM files are preserved in the bundle by adding to `next.config.ts`:

```ts
export default {
  serverExternalPackages: ["web-tree-sitter"],
};
```

## Usage Example

```ts
import { indexRepo } from "./lib/repo-indexer";

const result = await indexRepo({
  url: "https://github.com/expressjs/express",
  token: process.env.GITHUB_TOKEN, // optional
});

if (result.ok) {
  const { functions, calls, files } = result.data;
  console.log(`Indexed ${functions.length} functions across ${files.length} files.`);

  // Find top functions by importance
  const topFunctions = [...functions].sort((a, b) => b.importance - a.importance).slice(0, 5);
  for (const fn of topFunctions) {
    console.log(`${fn.qualifiedName} [${fn.category}] - score: ${fn.importance}`);
  }
} else {
  console.error("Index failed:", result.reason);
}
```

## Options and Limits

- Default file size cap is 200 KB per file.
- Default file count cap is 400 supported files.
- Default concurrent GitHub API requests is 8.
- Flags repositories marked as `truncated` by GitHub when the tree exceeds API size limits.
- Supports both remote GitHub repositories (`indexRepo`) and in-memory source files (`indexSourceFiles`).

## Dependencies and Licences

- `web-tree-sitter` — MIT: https://github.com/tree-sitter/tree-sitter
- `tree-sitter-wasms` — MIT: https://github.com/SamSovereign/tree-sitter-wasms

## Contributors

Roshaan Tahir, M Hammad Khan, Fizzah Abdullah, Hammad Khan

---

## GIG READY block

GIG READY: GitHub Repo Indexer
Publish at Devmarketplace → Add your Gigs

1. Thumbnail
   Upload docs/gigs/thumbnails/github-repo-indexer.png

2. Basic Info
   Title (49/50): GitHub Repo Indexer: functions, calls and metrics
   Description (195/200): Point it at a public GitHub repo and get every Python, JavaScript and TypeScript function with exact line ranges, a call graph and simple metrics. Uses tree-sitter. No cloning, no code execution.

3. Tech Stack
   Skills (pick the closest ones in the list): TypeScript, Node.js
   Custom tags (6/10, press Enter after each): tree-sitter, Octokit, GitHub API, static analysis, call graph, code search

4. Code Snippet
   Language: TypeScript
   From: lib/repo-indexer/index.ts, lines 177 to 207

```ts
export async function indexRepo(
  options: IndexRepoOptions,
): Promise<IndexRepoResult> {
  const parsed = parseRepoUrl(options.url);
  if (!parsed.ok) return parsed;

  const { owner, repo } = parsed.data;
  const token = options.token ?? process.env.GITHUB_TOKEN ?? "";

  // 1. Fetch file tree without cloning
  const treeResult = await fetchDefaultBranchTree({
    owner,
    repo,
    token,
    signal: options.signal,
  });
  if (!treeResult.ok) return { ok: false, reason: treeResult.reason };

  // 2. Filter supported source files (Python, JS, TS, TSX)
  const sourcePaths = filterTree(treeResult.data.entries).filter(isSupportedSourcePath);
  const fetchResult = await fetchFiles({
    owner,
    repo,
    ref: treeResult.data.defaultBranch,
    paths: sourcePaths.slice(0, options.limits?.maxFiles ?? 400),
    token,
  });

  // 3. Extract functions, resolve call graph, and compute metrics
  const allFunctions = await extractAllFunctions(fetchResult.files);
  const resolvedCalls = resolveCalls(allFunctions.rawCalls, allFunctions.list);
  const indexedFunctions = await computeAllMetrics(allFunctions.list, allFunctions.rawCalls, resolvedCalls);

  return { ok: true, data: { owner, name: repo, functions: indexedFunctions, calls: resolvedCalls, files: fetchResult.files.map((f) => f.path) } };
}
```

5. Read ME
   Open docs/gigs/github-repo-indexer.md on GitHub, copy the rendered page and paste it into the editor.

6. After you click Create
   Add the gig link to the tracker in docs/GIGS.md and to the Devpost draft.
