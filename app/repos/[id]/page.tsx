import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAal2User } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RepoDetailView, type RepoFunctionItem } from "@/components/repo/repo-detail-view";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Repository · CodeWiz" };
export const dynamic = "force-dynamic";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAal2User("/dashboard");
  const { id: repoId } = await params;

  const client = await createClient();
  if (!client.ok) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-destructive">Failed to connect to the database.</p>
      </div>
    );
  }

  // Load repo row with user isolation check.
  const { data: repoRow } = await client.data
    .from("repos")
    .select("id, url, owner, name, branch, folder, status, file_count, function_count, commit_sha")
    .eq("id", repoId)
    .eq("user_id", user.id)
    .single();

  if (!repoRow) {
    notFound();
  }

  // Load functions ordered by importance descending.
  const { data: functionRows } = await client.data
    .from("functions")
    .select(
      "id, name, qualified_name, file_path, language, start_line, end_line, code, length, branches, callers, callees, data_access, category, importance, explained",
    )
    .eq("repo_id", repoId)
    .eq("user_id", user.id)
    .order("importance", { ascending: false });

  // Load total call edges count.
  const { count: callCount } = await client.data
    .from("function_calls")
    .select("caller_id", { count: "exact", head: true })
    .eq("repo_id", repoId)
    .eq("user_id", user.id);

  const functions: RepoFunctionItem[] = (functionRows ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    qualifiedName: f.qualified_name,
    filePath: f.file_path,
    language: f.language,
    startLine: f.start_line,
    endLine: f.end_line,
    code: f.code,
    branches: f.branches,
    callers: f.callers,
    callees: f.callees,
    category: f.category,
    importance: f.importance,
    explained: f.explained ?? false,
  }));

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-lg font-bold tracking-tight hover:opacity-80">
              CodeWiz
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-muted-foreground">Repository</span>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">← Back to Dashboard</Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <RepoDetailView
          repo={{
            id: repoRow.id,
            owner: repoRow.owner,
            name: repoRow.name,
            branch: repoRow.branch,
            url: repoRow.url,
            status: repoRow.status,
            fileCount: repoRow.file_count ?? 0,
            functionCount: repoRow.function_count ?? functions.length,
            folder: repoRow.folder,
            commitSha: repoRow.commit_sha ?? null,
          }}
          functions={functions}
          callCount={callCount ?? 0}
        />
      </main>
    </div>
  );
}
