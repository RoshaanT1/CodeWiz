// Main entry point for GitHub Repo Indexer (Devmarketplace Gig 1).
// Extracts functions, builds an approximate call map, and computes metrics & importance.
// Static analysis only: code is parsed with tree-sitter, never executed.
// Self-contained: no imports from the app, Supabase or Next.js.

import {
  extractCallsFromFile,
  resolveCalls,
  type RawCall,
  type ResolvedCall,
} from "./extract-calls";
import { extractFunctions } from "./extract-functions";
import { fetchFiles, type SkippedFile } from "./fetch-files";
import { fetchDefaultBranchTree } from "./fetch-tree";
import { filterTree } from "./file-tree";
import { isSupportedSourcePath } from "./languages";
import {
  computeAllMetrics,
  type FunctionCategory,
  type FunctionMetrics,
  type IndexedFunction,
} from "./metrics";
import { parseRepoUrl } from "./parse-repo-url";
import type { ExtractedFunction, Result, SupportedLanguage } from "./types";

export type {
  ExtractedFunction,
  FunctionCategory,
  FunctionMetrics,
  IndexedFunction,
  ResolvedCall,
  SupportedLanguage,
};

export type IndexRepoLimits = {
  /** Maximum number of supported files to fetch and parse (default: 400). */
  maxFiles?: number;
  /** Files larger than this in bytes are skipped (default: 200 KB). */
  maxFileSize?: number;
  /** Maximum parallel requests to GitHub API (default: 8). */
  parallelRequests?: number;
};

export type IndexRepoOptions = {
  /** GitHub repository URL (e.g. "https://github.com/owner/repo" or "owner/repo"). */
  url: string;
  /** GitHub personal access token (optional, recommended to avoid rate limits). */
  token?: string;
  /** Optional subfolder path to limit indexing to a specific directory. */
  folder?: string;
  /** Configurable file caps and concurrency limits. */
  limits?: IndexRepoLimits;
  signal?: AbortSignal;
};

export type IndexRepoOutput = {
  owner: string;
  name: string;
  commitSha: string;
  files: string[];
  functions: IndexedFunction[];
  calls: ResolvedCall[];
  skipped: SkippedFile[];
  truncated: boolean;
};

export type IndexRepoResult = Result<IndexRepoOutput>;

export type IndexSourceFileInput = {
  path: string;
  source: string;
};

export type IndexFilesOptions = {
  owner?: string;
  name?: string;
  commitSha?: string;
  files: IndexSourceFileInput[];
};

/**
 * Indexes an array of in-memory source files directly.
 * Useful for local projects, tests, and CI pipelines without GitHub API calls.
 */
export async function indexSourceFiles(
  options: IndexFilesOptions,
): Promise<IndexRepoResult> {
  const owner = options.owner ?? "local";
  const name = options.name ?? "repo";
  const commitSha = options.commitSha ?? "0000000000000000000000000000000000000000";

  const supportedFiles = options.files.filter((f) =>
    isSupportedSourcePath(f.path),
  );

  const allFunctions: ExtractedFunction[] = [];
  const rawCalls: RawCall[] = [];
  const skipped: SkippedFile[] = [];

  for (const file of supportedFiles) {
    const fnResult = await extractFunctions({
      filePath: file.path,
      source: file.source,
    });

    if (fnResult.ok) {
      allFunctions.push(...fnResult.data);
      const calls = await extractCallsFromFile(
        file.path,
        file.source,
        fnResult.data,
      );
      rawCalls.push(...calls);
    } else {
      skipped.push({ path: file.path, reason: fnResult.reason });
    }
  }

  const resolvedCalls = resolveCalls(rawCalls, allFunctions);
  const indexedFunctions = await computeAllMetrics(
    allFunctions,
    rawCalls,
    resolvedCalls,
  );

  return {
    ok: true,
    data: {
      owner,
      name,
      commitSha,
      files: supportedFiles.map((f) => f.path),
      functions: indexedFunctions,
      calls: resolvedCalls,
      skipped,
      truncated: false,
    },
  };
}

/**
 * Points at a public GitHub repo, fetches the tree, reads source files,
 * parses functions with tree-sitter, resolves the call graph, and computes metrics.
 */
export async function indexRepo(
  options: IndexRepoOptions,
): Promise<IndexRepoResult> {
  const parsed = parseRepoUrl(options.url);
  if (!parsed.ok) return parsed;

  const { owner, repo } = parsed.data;
  const token = options.token ?? process.env.GITHUB_TOKEN ?? "";

  // 1. Fetch file tree
  const treeResult = await fetchDefaultBranchTree({
    owner,
    repo,
    token,
    signal: options.signal,
  });

  if (!treeResult.ok) {
    return { ok: false, reason: treeResult.reason };
  }

  const { entries, truncated, defaultBranch } = treeResult.data;

  // 2. Filter tree
  let candidatePaths = filterTree(entries);

  // Apply folder filter if specified
  const targetFolder = options.folder ?? parsed.data.path;
  if (targetFolder) {
    const prefix = targetFolder.endsWith("/") ? targetFolder : `${targetFolder}/`;
    candidatePaths = candidatePaths.filter(
      (p) => p.startsWith(prefix) || p === targetFolder,
    );
  }

  // Filter for parseable extensions (python, javascript, typescript, tsx)
  const sourcePaths = candidatePaths.filter(isSupportedSourcePath);

  const maxFiles = options.limits?.maxFiles ?? 400;
  const pathsToFetch = sourcePaths.slice(0, maxFiles);

  // 3. Fetch file contents
  const fetchResult = await fetchFiles({
    owner,
    repo,
    ref: defaultBranch,
    paths: pathsToFetch,
    token,
    concurrency: options.limits?.parallelRequests ?? 8,
    maxFileBytes: options.limits?.maxFileSize ?? 200 * 1024,
    signal: options.signal,
  });

  // 4. Extract functions and call expressions
  const allFunctions: ExtractedFunction[] = [];
  const rawCalls: RawCall[] = [];
  const skipped: SkippedFile[] = [...fetchResult.skipped];

  for (const file of fetchResult.files) {
    const fnResult = await extractFunctions({
      filePath: file.path,
      source: file.source,
    });

    if (fnResult.ok) {
      allFunctions.push(...fnResult.data);
      const calls = await extractCallsFromFile(
        file.path,
        file.source,
        fnResult.data,
      );
      rawCalls.push(...calls);
    } else {
      skipped.push({ path: file.path, reason: fnResult.reason });
    }
  }

  // 5. Resolve calls and compute metrics
  const resolvedCalls = resolveCalls(rawCalls, allFunctions);
  const indexedFunctions = await computeAllMetrics(
    allFunctions,
    rawCalls,
    resolvedCalls,
  );

  return {
    ok: true,
    data: {
      owner,
      name: repo,
      commitSha: defaultBranch,
      files: fetchResult.files.map((f) => f.path),
      functions: indexedFunctions,
      calls: resolvedCalls,
      skipped,
      truncated,
    },
  };
}
