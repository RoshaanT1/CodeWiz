import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireAal2User } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RoundRunner, type RoundFunctionData } from "@/components/round/round-runner";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Practice Round · CodeWiz" };
export const dynamic = "force-dynamic";

export default async function RoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAal2User("/dashboard");
  const { id: roundId } = await params;

  const client = await createClient();
  if (!client.ok) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-destructive">Failed to connect to database.</p>
      </div>
    );
  }

  // Load round.
  const { data: roundRow } = await client.data
    .from("rounds")
    .select("id, size, status, repo_id")
    .eq("id", roundId)
    .eq("user_id", user.id)
    .single();

  if (!roundRow) {
    notFound();
  }

  if (roundRow.status === "completed") {
    redirect(`/rounds/${roundId}/results`);
  }

  // Load round_functions ordered by position.
  const { data: rfRows } = await client.data
    .from("round_functions")
    .select("id, function_id, position, selection_reason")
    .eq("round_id", roundId)
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  if (!rfRows || rfRows.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-muted-foreground">No functions assigned to this round.</p>
      </div>
    );
  }

  // Load function codes.
  const fnIds = rfRows.map((rf) => rf.function_id);
  const { data: fnRows } = await client.data
    .from("functions")
    .select("id, name, qualified_name, file_path, language, start_line, code, explanation")
    .in("id", fnIds);

  const fnMap = new Map((fnRows ?? []).map((f) => [f.id, f]));

  const functions: RoundFunctionData[] = rfRows.map((rf) => {
    const fn = fnMap.get(rf.function_id);
    return {
      id: rf.id,
      functionId: rf.function_id,
      position: rf.position ?? 1,
      selectionReason: rf.selection_reason,
      name: fn?.name ?? "Unknown Function",
      qualifiedName: fn?.qualified_name ?? null,
      filePath: fn?.file_path ?? "",
      language: fn?.language ?? "typescript",
      startLine: fn?.start_line ?? 1,
      code: fn?.code ?? "",
      explanation: fn?.explanation ?? null,
    };
  });

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-lg font-bold tracking-tight hover:opacity-80">
              CodeWiz
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-muted-foreground">Active Round</span>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/repos/${roundRow.repo_id}`}>Exit to Repo</Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <RoundRunner
          round={{
            id: roundRow.id,
            size: roundRow.size,
            status: roundRow.status ?? "active",
            repoId: roundRow.repo_id,
          }}
          functions={functions}
        />
      </main>
    </div>
  );
}
