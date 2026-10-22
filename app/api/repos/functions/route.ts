// TEMPORARY route for PARSE-1 and PARSE-2 (tree-sitter on the server).
// It is NOT part of the docs/ARCHITECTURE.md API contract. It will be replaced
// by POST /api/repos/[id]/index (PARSE-5). It writes nothing to the database.
// The 20-file cap is specific to this temporary route.
//
// GET /api/repos/functions?repo_id=<uuid>
// Returns the stored call edges for a repo (used by the Call Map).
import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/server/responses";

export async function GET(request: Request) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return apiError(session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", session.reason, session.status);
  }
  const userId = session.data.id;

  const url = new URL(request.url);
  const repoId = url.searchParams.get("repo_id");
  if (!repoId) return apiError("BAD_REQUEST", "repo_id query param required.", 400);

  const client = await createClient();
  if (!client.ok) return apiError("UPSTREAM", client.reason, 503);

  // Verify ownership.
  const { data: repo } = await client.data
    .from("repos").select("id").eq("id", repoId).eq("user_id", userId).single();
  if (!repo) return apiError("NOT_FOUND", "Repo not found.", 404);

  const { data: callRows } = await client.data
    .from("function_calls")
    .select("caller_id, callee_id")
    .eq("repo_id", repoId)
    .eq("user_id", userId)
    .limit(2000);

  return NextResponse.json({
    ok: true,
    data: {
      calls: (callRows ?? []).map((r) => ({ callerId: r.caller_id, calleeId: r.callee_id })),
    },
  });
}

import { extractFunctions } from "@/lib/repo-indexer/extract-functions";
import { fetchFiles } from "@/lib/repo-indexer/fetch-files";
import { fetchDefaultBranchTree } from "@/lib/repo-indexer/fetch-tree";
import { filterTree } from "@/lib/repo-indexer/file-tree";
import { isSupportedSourcePath } from "@/lib/repo-indexer/languages";
import { parseRepoUrl } from "@/lib/repo-indexer/parse-repo-url";
import type { ExtractedFunction } from "@/lib/repo-indexer/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 20;
const MAX_FILE_BYTES = 200 * 1024; // per-file cap from docs/ARCHITECTURE.md
const PARALLEL_REQUESTS = 8;

type ErrorCode =
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "INVALID_URL"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_CONFIG"
  | "PARSER"
  | "UPSTREAM";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json(
    { ok: false as const, error: { code, message } },
    { status },
  );
}

export async function POST(request: Request) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(
      session.status === 401 ? "UNAUTHORIZED" : "UPSTREAM",
      session.reason,
      session.status,
    );
  }

  let url: unknown;
  try {
    const body: unknown = await request.json();
    url =
      typeof body === "object" && body !== null && "url" in body
        ? (body as { url: unknown }).url
        : undefined;
  } catch {
    return error("BAD_REQUEST", 'Send a JSON body like { "url": "owner/repo" }.', 400);
  }
  if (typeof url !== "string" || url.length > 500) {
    return error("INVALID_URL", "Enter a GitHub repo URL.", 400);
  }

  const parsed = parseRepoUrl(url);
  if (!parsed.ok) return error("INVALID_URL", parsed.reason, 400);

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return error(
      "SERVER_CONFIG",
      "GITHUB_TOKEN isn't set on the server. Add it in the Secrets panel (or .env.local) and restart.",
      500,
    );
  }

  const { owner, repo, path: folder } = parsed.data;
  const tree = await fetchDefaultBranchTree({ owner, repo, token });
  if (!tree.ok) {
    switch (tree.code) {
      case "NOT_FOUND":
        return error(
          "NOT_FOUND",
          "We couldn't find that repo. It may not exist, or it may be private.",
          404,
        );
      case "RATE_LIMITED":
        return error(
          "RATE_LIMITED",
          "GitHub's rate limit has been reached. Wait a few minutes and try again.",
          429,
        );
      case "GITHUB_AUTH":
        return error(
          "SERVER_CONFIG",
          "GitHub rejected the server's GITHUB_TOKEN. Check that it's valid.",
          502,
        );
      default:
        return error("UPSTREAM", tree.reason, 502);
    }
  }

  const sizes = new Map(tree.data.entries.map((e) => [e.path, e.size]));
  const candidates = filterTree(tree.data.entries).filter((p) => {
    if (!isSupportedSourcePath(p)) return false;
    if (folder && p !== folder && !p.startsWith(`${folder}/`)) return false;
    const size = sizes.get(p);
    return size === undefined || size <= MAX_FILE_BYTES;
  });
  const chosen = candidates.slice(0, MAX_FILES);

  const fetched = await fetchFiles({
    owner,
    repo,
    ref: tree.data.defaultBranch,
    paths: chosen,
    token,
    concurrency: PARALLEL_REQUESTS,
    maxFileBytes: MAX_FILE_BYTES,
  });

  const functions: ExtractedFunction[] = [];
  const skipped = [...fetched.skipped];
  for (const file of fetched.files) {
    const result = await extractFunctions({
      filePath: file.path,
      source: file.source,
    });
    if (result.ok) {
      functions.push(...result.data);
    } else if (/grammar/i.test(result.reason)) {
      // The parser itself is broken: report it instead of hiding it.
      return error("PARSER", result.reason, 500);
    } else {
      skipped.push({ path: file.path, reason: result.reason });
    }
  }

  return NextResponse.json({
    ok: true as const,
    data: {
      owner,
      repo,
      defaultBranch: tree.data.defaultBranch,
      truncated: tree.data.truncated,
      supportedFileCount: candidates.length,
      filesFetched: fetched.files.length,
      fileLimit: MAX_FILES,
      rateLimited: fetched.rateLimited,
      skipped,
      functionCount: functions.length,
      functions,
    },
  });
}
