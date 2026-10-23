// POST /api/repos: validates the URL, indexes the repo (files, functions,
// calls, metrics) and stores it. Indexing runs in this request, so the file
// cap keeps it inside maxDuration. Static analysis only: no code is run.
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiAal2Session } from "@/lib/auth/session";
import { indexRepo } from "@/lib/repo-indexer";
import { parseRepoUrl } from "@/lib/repo-indexer/parse-repo-url";
import { isEligibleCandidate } from "@/lib/selection/rank";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILES = 150;
const BATCH = 200;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "INVALID_URL" | "CONFLICT" | "SERVER_CONFIG" | "UPSTREAM" | "RATE_LIMITED";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const BodySchema = z.object({
  url: z.string().trim().min(1, "Enter a GitHub repo URL.").max(500),
  folder: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  // Imports are the heaviest request, so they share Fizzah's per-user limiter.
  const rateCheck = checkRateLimit(`repos:${userId}`, RATE_LIMITS.repoImport);
  if (!rateCheck.ok) return error("RATE_LIMITED", rateCheck.reason, 429);

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return error("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Enter a GitHub repo URL.", 400);
    body = parsed.data;
  } catch {
    return error("BAD_REQUEST", 'Send JSON like { "url": "https://github.com/owner/repo" }.', 400);
  }

  const parsedUrl = parseRepoUrl(body.url);
  if (!parsedUrl.ok) return error("INVALID_URL", parsedUrl.reason, 400);
  const { owner, repo } = parsedUrl.data;
  const folder = body.folder || parsedUrl.data.path || null;

  const token = process.env.GITHUB_TOKEN;
  if (!token) return error("SERVER_CONFIG", "GITHUB_TOKEN isn't set on the server.", 500);

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;

  const sameRepo = db
    .from("repos")
    .select("id, status")
    .eq("user_id", userId)
    .eq("owner", owner)
    .eq("name", repo)
    .eq("status", "indexed");
  const { data: existing } = await (folder ? sameRepo.eq("folder", folder) : sameRepo.is("folder", null))
    .limit(1)
    .maybeSingle<{ id: string; status: string }>();
  if (existing) return NextResponse.json({ ok: true as const, data: { repoId: existing.id, reused: true } });

  const { data: repoRow, error: repoError } = await db
    .from("repos")
    .insert({ user_id: userId, url: `https://github.com/${owner}/${repo}`, owner, name: repo, folder, status: "importing" })
    .select("id")
    .single<{ id: string }>();
  if (repoError || !repoRow) return error("UPSTREAM", "Couldn't save the repo. Try again.", 502);
  const repoId = repoRow.id;

  const fail = async (message: string, status = 502) => {
    await db.from("repos").update({ status: "failed" }).eq("id", repoId).eq("user_id", userId);
    return error("UPSTREAM", message, status);
  };

  const indexed = await indexRepo({ url: body.url, token, folder: folder ?? undefined, limits: { maxFiles: MAX_FILES } });
  if (!indexed.ok) {
    const notFound = /not found|404/i.test(indexed.reason);
    return fail(notFound ? "We couldn't find that repo. It may not exist, or it may be private." : indexed.reason, notFound ? 404 : 502);
  }
  if (indexed.data.functions.length === 0) {
    console.warn(`[repos] no functions from ${indexed.data.files.length} files; skipped: ${JSON.stringify(indexed.data.skipped.slice(0, 3))}`);
    return fail(
      folder
        ? `We didn't find any Python, JavaScript or TypeScript functions in ${folder}. Check the folder name.`
        : "We didn't find any Python, JavaScript or TypeScript functions in that repo.",
      422,
    );
  }

  // The indexer's ids aren't always unique (a property getter and setter share
  // one), so every function gets its own UUID and calls resolve to the first.
  const rowIds = indexed.data.functions.map(() => randomUUID());
  const ids = new Map<string, string>();
  indexed.data.functions.forEach((fn, i) => {
    if (!ids.has(fn.id)) ids.set(fn.id, rowIds[i] ?? randomUUID());
  });
  const rows = indexed.data.functions.map((fn, i) => {
    const candidate = {
      id: fn.id,
      name: fn.name,
      qualifiedName: fn.qualifiedName,
      file: `/${fn.filePath}`,
      language: fn.language,
      startLine: fn.startLine,
      endLine: fn.endLine,
      length: fn.metrics.length,
      branches: fn.metrics.branches,
      callers: fn.metrics.callers,
      callees: fn.metrics.callees,
      dataAccess: fn.metrics.dataAccess,
      category: fn.category,
    };
    return {
      id: rowIds[i],
      user_id: userId,
      repo_id: repoId,
      file_path: fn.filePath,
      name: fn.name,
      qualified_name: fn.qualifiedName,
      // The table stores TSX as TypeScript.
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
      excluded: !isEligibleCandidate(candidate),
    };
  });
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error: insertError } = await db.from("functions").insert(rows.slice(i, i + BATCH));
    if (insertError) {
      console.warn(`[repos] function insert failed: ${insertError.message}`);
      return fail("Couldn't save the functions. Try again.");
    }
  }

  const seen = new Set<string>();
  const callRows = indexed.data.calls.flatMap((call) => {
    const caller = ids.get(call.callerId);
    const callee = ids.get(call.calleeId);
    const key = `${caller}:${callee}`;
    if (!caller || !callee || caller === callee || seen.has(key)) return [];
    seen.add(key);
    return [{ user_id: userId, repo_id: repoId, caller_id: caller, callee_id: callee }];
  });
  for (let i = 0; i < callRows.length; i += BATCH) {
    const { error: callError } = await db.from("function_calls").insert(callRows.slice(i, i + BATCH));
    if (callError) {
      console.warn(`[repos] call insert failed: ${callError.message}`);
      return fail("Couldn't save the call map. Try again.");
    }
  }

  await db
    .from("repos")
    .update({
      status: "indexed",
      branch: indexed.data.commitSha,
      file_count: indexed.data.files.length,
      function_count: rows.length,
    })
    .eq("id", repoId)
    .eq("user_id", userId);

  return NextResponse.json({
    ok: true as const,
    data: { repoId, reused: false, functionCount: rows.length, truncated: indexed.data.truncated || indexed.data.files.length >= MAX_FILES },
  });
}
