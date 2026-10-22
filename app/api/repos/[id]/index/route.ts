import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { indexRepo } from "@/lib/repo-indexer";
import { apiError } from "@/lib/server/responses";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/repos/[id]/index
 * Imports and parses the repo: fetches files, extracts functions and calls,
 * computes metrics, and persists everything to the functions + function_calls
 * tables. Updates repos.status to "indexed" or "failed".
 *
 * This is PARSE-5: the store step.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return apiError(
      session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      session.reason,
      session.status,
    );
  }
  const userId = session.data.id;
  const { id: repoId } = await params;

  const client = await createClient();
  if (!client.ok) return apiError("UPSTREAM", client.reason, 503);

  // Verify the repo belongs to this user.
  const { data: repoRow, error: repoErr } = await client.data
    .from("repos")
    .select("id, url, folder, commit_sha, status, owner, name, branch")
    .eq("id", repoId)
    .eq("user_id", userId)
    .single();

  if (repoErr || !repoRow) {
    return apiError("NOT_FOUND", "Repo not found.", 404);
  }
  if (repoRow.status === "indexed") {
    return NextResponse.json({ ok: true, data: { status: "indexed", cached: true } });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return apiError("SERVER_CONFIG", "GITHUB_TOKEN is not configured.", 500);
  }

  // Run the full indexer (PARSE-1 through PARSE-4).
  const result = await indexRepo({
    url: `https://github.com/${repoRow.owner}/${repoRow.name}`,
    token,
    folder: repoRow.folder ?? undefined,
    limits: { maxFiles: 400, maxFileSize: 200 * 1024, parallelRequests: 8 },
  });

  if (!result.ok) {
    await client.data
      .from("repos")
      .update({ status: "failed" })
      .eq("id", repoId);
    return apiError("UPSTREAM", result.reason, 502);
  }

  const { functions, calls } = result.data;

  // Batch insert functions (no duplicates on re-index — delete existing first).
  await client.data.from("functions").delete().eq("repo_id", repoId);
  await client.data.from("function_calls").delete().eq("repo_id", repoId);

  if (functions.length > 0) {
    const rows = functions.map((fn) => ({
      user_id: userId,
      repo_id: repoId,
      file_path: fn.filePath,
      name: fn.name,
      qualified_name: fn.qualifiedName,
      language: fn.language === "tsx" ? "typescript" : fn.language,
      start_line: fn.startLine,
      end_line: fn.endLine,
      code: fn.code,
      length: fn.metrics.length,
      branches: fn.metrics.branches,
      callers: fn.metrics.callers,
      callees: fn.metrics.callees,
      data_access: fn.metrics.dataAccess,
      category: fn.category,
      importance: fn.importance,
      excluded: false,
    }));

    // Insert in batches of 200 to stay within Supabase request limits.
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await client.data.from("functions").insert(rows.slice(i, i + 200));
      if (error) {
        await client.data.from("repos").update({ status: "failed" }).eq("id", repoId);
        return apiError("UPSTREAM", "Failed to save functions: " + error.message, 500);
      }
    }
  }

  // Build a key→id map for call resolution.
  const { data: storedFns } = await client.data
    .from("functions")
    .select("id, qualified_name, name, file_path")
    .eq("repo_id", repoId);

  if (storedFns && storedFns.length > 0 && calls.length > 0) {
    const keyToId = new Map<string, string>();
    for (const fn of storedFns) {
      keyToId.set(`${fn.file_path}#${fn.qualified_name ?? fn.name}`, fn.id);
      keyToId.set(`${fn.file_path}#${fn.name}`, fn.id);
      if (fn.qualified_name) keyToId.set(fn.qualified_name, fn.id);
      keyToId.set(fn.name, fn.id);
    }

    const callRows: { user_id: string; repo_id: string; caller_id: string; callee_id: string }[] = [];
    const seen = new Set<string>();
    for (const call of calls) {
      const callerId = keyToId.get(call.callerId) ?? keyToId.get(call.callerName);
      const calleeId = keyToId.get(call.calleeId) ?? keyToId.get(call.calleeName);
      if (!callerId || !calleeId || callerId === calleeId) continue;
      const key = `${callerId}:${calleeId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      callRows.push({ user_id: userId, repo_id: repoId, caller_id: callerId, callee_id: calleeId });
    }

    for (let i = 0; i < callRows.length; i += 200) {
      await client.data.from("function_calls").insert(callRows.slice(i, i + 200));
    }
  }

  // Update repo status and counts.
  await client.data.from("repos").update({
    status: "indexed",
    file_count: result.data.files.length,
    function_count: functions.length,
  }).eq("id", repoId);

  return NextResponse.json({
    ok: true,
    data: {
      status: "indexed",
      fileCount: result.data.files.length,
      functionCount: functions.length,
      callCount: calls.length,
      skipped: result.data.skipped.length,
      truncated: result.data.truncated,
    },
  });
}
