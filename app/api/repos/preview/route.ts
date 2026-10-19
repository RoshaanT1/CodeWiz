// TEMPORARY route for the "Repo file preview" checkpoint.
// It is NOT part of the docs/ARCHITECTURE.md API contract and should be
// replaced by the contract's import route later.
import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { fetchDefaultBranchTree } from "@/lib/repo-indexer/fetch-tree";
import {
  filterTree,
  type RepoPreviewData,
} from "@/lib/repo-indexer/file-tree";
import { parseRepoUrl } from "@/lib/repo-indexer/parse-repo-url";

export const runtime = "nodejs";

type ErrorCode =
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "INVALID_URL"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_CONFIG"
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
    return error("BAD_REQUEST", "Send a JSON body like { \"url\": \"owner/repo\" }.", 400);
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

  const { owner, repo, branch } = parsed.data;
  const result = await fetchDefaultBranchTree({ owner, repo, token });

  if (!result.ok) {
    switch (result.code) {
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
        return error("UPSTREAM", result.reason, 502);
    }
  }

  const files = filterTree(result.data.entries);
  const data: RepoPreviewData = {
    owner,
    repo,
    defaultBranch: result.data.defaultBranch,
    requestedBranch: branch,
    truncated: result.data.truncated,
    fileCount: files.length,
    files,
  };
  return NextResponse.json({ ok: true as const, data });
}
