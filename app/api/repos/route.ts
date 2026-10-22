import { z } from "zod";
import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseRepoUrl } from "@/lib/repo-indexer/parse-repo-url";
import { fetchDefaultBranchTree } from "@/lib/repo-indexer/fetch-tree";
import { apiError } from "@/lib/server/responses";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { audit, newRequestId } from "@/lib/server/audit-log";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  url: z.string().min(1).max(500),
  folder: z.string().optional(),
});

/**
 * POST /api/repos
 * Validates the URL, reads repo metadata from GitHub, and creates the repo row
 * with status "importing". The client then calls POST /api/repos/[id]/index.
 */
export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? newRequestId();

  const session = await requireApiAal2Session();
  if (!session.ok) {
    audit(session.status === 401 ? "api.unauthorized" : "api.forbidden", {
      requestId, route: "/api/repos", method: "POST",
    });
    return apiError(
      session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      session.reason,
      session.status,
    );
  }
  const userId = session.data.id;

  // SEC-06: In-memory sliding-window rate limit (10 req/min per user).
  const rateCheck = checkRateLimit(`repos:${userId}`, RATE_LIMITS.repoImport);
  if (!rateCheck.ok) {
    audit("api.rate_limited", {
      requestId, userId, route: "/api/repos", method: "POST",
      meta: { retryAfterMs: rateCheck.retryAfterMs },
    });
    return apiError("RATE_LIMITED", rateCheck.reason, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Send a JSON body with a url field.", 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid body.", 400);
  }

  const urlResult = parseRepoUrl(parsed.data.url);
  if (!urlResult.ok) {
    return apiError("INVALID_URL", urlResult.reason, 400);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return apiError("SERVER_CONFIG", "GITHUB_TOKEN is not configured on the server.", 500);
  }

  const { owner, repo } = urlResult.data;

  // Verify repository visibility: CodeWiz strictly imports public repositories.
  try {
    const repoMetaRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "codewiz-repo-indexer",
        },
        cache: "no-store",
      },
    );
    if (repoMetaRes.status === 404) {
      return apiError("NOT_FOUND", "Repository not found on GitHub.", 404);
    }
    if (repoMetaRes.ok) {
      const meta = (await repoMetaRes.json()) as { private?: boolean };
      if (meta.private) {
        audit("repo.import_private_blocked", {
          requestId, userId, route: "/api/repos", method: "POST",
          meta: { owner, repo },
        });
        return apiError(
          "FORBIDDEN",
          "Only public GitHub repositories can be imported into CodeWiz.",
          403,
        );
      }
    }
  } catch {
    // Network fallback: let fetchDefaultBranchTree handle connection
  }

  const tree = await fetchDefaultBranchTree({ owner, repo, token });
  if (!tree.ok) {
    const map: Record<string, [string, number]> = {
      NOT_FOUND: ["NOT_FOUND", 404],
      RATE_LIMITED: ["RATE_LIMITED", 429],
      GITHUB_AUTH: ["SERVER_CONFIG", 502],
    };
    const [code, status] = map[tree.code] ?? ["UPSTREAM", 502];
    return apiError(code as never, tree.reason, status);
  }

  const client = await createClient();
  if (!client.ok) {
    return apiError("UPSTREAM", client.reason, 503);
  }

  // Reuse existing row if the same user/owner/repo/folder combination
  // was already registered to avoid duplicate records.
  const { data: existing } = await client.data
    .from("repos")
    .select("id, status")
    .eq("user_id", userId)
    .eq("owner", owner)
    .eq("name", repo)
    .eq("folder", parsed.data.folder ?? "")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, data: { id: existing.id, status: existing.status } });
  }

  const { data: row, error } = await client.data
    .from("repos")
    .insert({
      user_id: userId,
      url: parsed.data.url,
      owner,
      name: repo,
      branch: tree.data.defaultBranch,
      commit_sha: tree.data.defaultBranch,
      folder: parsed.data.folder ?? null,
      status: "importing",
    })
    .select("id")
    .single();

  if (error || !row) {
    return apiError("UPSTREAM", "Failed to create repo record.", 500);
  }

  audit("repo.import", {
    requestId, userId, route: "/api/repos", method: "POST",
    meta: { repoId: row.id, owner, repo },
  });

  return NextResponse.json({ ok: true, data: { id: row.id, status: "importing" } }, { status: 201 });
}
