// POST /api/round-functions/[id]/suggestions: suggestion cards for one
// function. Library suggestions (AI step H, verified against the registry)
// are built here when FEATURE_LIBRARY_CHECK is on. Semgrep findings (step I)
// will be added by SEC-2 and SEC-3.
import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { suggestLibrary } from "@/lib/ai/suggest-library";
import { requireApiAal2Session } from "@/lib/auth/session";
import { checkAiCap } from "@/lib/server/daily-cap";
import { verifyPackage } from "@/lib/registry-verifier";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER_CONFIG" | "UPSTREAM" | "RATE_LIMITED";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const ParamsSchema = z.object({ id: z.uuid() });

const RoundFunctionSchema = z.object({
  id: z.string(),
  functions: z.object({
    name: z.string(),
    file_path: z.string(),
    code: z.string(),
    language: z.enum(["python", "javascript", "typescript", "tsx"]),
    start_line: z.number().int().positive(),
  }),
});

const LibraryEvidenceSchema = z.object({
  ecosystem: z.enum(["npm", "pypi", "python_stdlib"]),
  package: z.string(),
  functionName: z.string(),
  docsUrl: z.string(),
});

const SuggestionRows = z.array(
  z.object({
    id: z.string(),
    kind: z.enum(["practice", "security", "library"]),
    detail: z.string().nullable(),
    evidence: z.unknown(),
    user_verdict: z.enum(["agree", "disagree"]).nullable(),
    user_reason: z.string().nullable(),
    reason_score: z.number().nullable(),
    feedback: z.string().nullable(),
  }),
);

type SuggestionView = {
  id: string;
  kind: "practice" | "security" | "library";
  detail: string;
  library: z.infer<typeof LibraryEvidenceSchema> | null;
  verdict: "agree" | "disagree" | null;
  reason: string | null;
  reasonScore: number | null;
  feedback: string | null;
};

/** Views for the browser. A library row without evidence means "checked, nothing to suggest". */
function toViews(rows: z.infer<typeof SuggestionRows>): SuggestionView[] {
  return rows.filter((row) => row.kind !== "library" || row.evidence !== null).map((row) => {
    const library = row.kind === "library" ? LibraryEvidenceSchema.safeParse(row.evidence) : null;
    return {
      id: row.id,
      kind: row.kind,
      detail: row.detail ?? "",
      library: library?.success ? library.data : null,
      verdict: row.user_verdict,
      reason: row.user_reason,
      reasonScore: row.reason_score,
      feedback: row.feedback,
    };
  });
}

const libraryCheckEnabled = () => process.env.FEATURE_LIBRARY_CHECK === "true";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) return error("BAD_REQUEST", "That round function id isn't valid.", 400);
  const roundFunctionId = parsedParams.data.id;

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;

  const { data: rfData, error: rfError } = await db
    .from("round_functions")
    .select("id, functions(name, file_path, code, language, start_line)")
    .eq("id", roundFunctionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (rfError) return error("UPSTREAM", "Couldn't load this function. Try again.", 502);
  if (!rfData) return error("NOT_FOUND", "We couldn't find that function in your rounds.", 404);
  const roundFunction = RoundFunctionSchema.safeParse(rfData);
  if (!roundFunction.success) return error("UPSTREAM", "This function's stored code is incomplete.", 502);
  const fn = roundFunction.data.functions;

  const select = "id, kind, detail, evidence, user_verdict, user_reason, reason_score, feedback";
  const { data: existing, error: existingError } = await db
    .from("suggestions")
    .select(select)
    .eq("round_function_id", roundFunctionId)
    .eq("user_id", userId);
  if (existingError) return error("UPSTREAM", "Couldn't load suggestions. Try again.", 502);
  const existingRows = SuggestionRows.parse(existing ?? []);

  // Generate the library suggestion once per round function.
  if (!libraryCheckEnabled() || existingRows.some((row) => row.kind === "library")) {
    return NextResponse.json({ ok: true as const, data: { suggestions: toViews(existingRows) } });
  }

  const cap = await checkAiCap(db, userId);
  if (!cap.ok) return error("RATE_LIMITED", cap.reason, 429);

  const calls = callCounter();
  const result = await suggestLibrary(
    { code: fn.code, startLine: fn.start_line, language: fn.language, name: fn.name, file: fn.file_path },
    { llm: loggedLlm({ route: "suggestions-library", temperature: 0.2, maxTokens: 500, onCall: calls.onCall }), verify: verifyPackage },
  );
  await recordAiCalls(db, userId, calls.count);
  if (!result.ok) return error("UPSTREAM", "The library check didn't finish. Try again.", 502);
  if (result.dropped) console.info(`[suggestions] dropped library suggestion: ${result.dropped}`);

  // Store a row even when there's no suggestion, so the check isn't repeated.
  const { data: inserted, error: insertError } = await db
    .from("suggestions")
    .insert({
      user_id: userId,
      round_function_id: roundFunctionId,
      kind: "library",
      detail: result.data?.why ?? null,
      evidence: result.data
        ? { ecosystem: result.data.ecosystem, package: result.data.package, functionName: result.data.functionName, docsUrl: result.data.docsUrl }
        : null,
    })
    .select(select);
  if (insertError) return error("UPSTREAM", "Couldn't save the suggestion. Try again.", 502);

  const rows = [...existingRows, ...SuggestionRows.parse(inserted ?? [])];
  return NextResponse.json({ ok: true as const, data: { suggestions: toViews(rows) } });
}
