import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type WorkspaceRepo = { id: string; owner: string; name: string; status: string; functionCount: number; createdAt: string };
export type WorkspaceRound = { id: string; repo: string; status: string; size: number; createdAt: string };

const RepoRows = z.array(
  z.object({ id: z.string(), owner: z.string(), name: z.string(), status: z.string(), function_count: z.number().nullable(), created_at: z.string() }),
);
const RoundRows = z.array(
  z.object({ id: z.string(), status: z.string().nullable(), size: z.number(), created_at: z.string(), repos: z.object({ owner: z.string(), name: z.string() }).nullable() }),
);

/** UI-1: the signed-in user's repos and recent rounds for the dashboard. */
export async function loadWorkspace(userId: string): Promise<{ ok: true; data: { repos: WorkspaceRepo[]; rounds: WorkspaceRound[] } } | { ok: false; reason: string }> {
  const client = await createClient();
  if (!client.ok) return client;
  const [repos, rounds] = await Promise.all([
    client.data.from("repos").select("id, owner, name, status, function_count, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    client.data.from("rounds").select("id, status, size, created_at, repos(owner, name)").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (repos.error || rounds.error) return { ok: false, reason: "Couldn't load your workspace. Try again in a moment." };
  return {
    ok: true,
    data: {
      repos: RepoRows.parse(repos.data ?? []).map((r) => ({
        id: r.id,
        owner: r.owner,
        name: r.name,
        status: r.status,
        functionCount: r.function_count ?? 0,
        createdAt: r.created_at,
      })),
      rounds: RoundRows.parse(rounds.data ?? []).map((r) => ({
        id: r.id,
        repo: r.repos ? `${r.repos.owner}/${r.repos.name}` : "Unknown repo",
        status: r.status ?? "in_progress",
        size: r.size,
        createdAt: r.created_at,
      })),
    },
  };
}

export type RepoFunction = { id: string; name: string; file: string; category: string; importance: number; reviewed: boolean; eligible: boolean };
export type RepoDetail = { id: string; owner: string; name: string; status: string; functions: RepoFunction[] };

const FunctionRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    qualified_name: z.string().nullable(),
    file_path: z.string(),
    category: z.string().nullable(),
    importance: z.number().nullable(),
    excluded: z.boolean(),
    explained: z.boolean(),
  }),
);

/** MAP-1: one repo's functions, most important first, with reviewed flags. */
export async function loadRepo(userId: string, repoId: string): Promise<{ ok: true; data: RepoDetail | null } | { ok: false; reason: string }> {
  const client = await createClient();
  if (!client.ok) return client;
  const { data: repo, error } = await client.data
    .from("repos")
    .select("id, owner, name, status")
    .eq("id", repoId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; owner: string; name: string; status: string }>();
  if (error) return { ok: false, reason: "Couldn't load this repo. Try again in a moment." };
  if (!repo) return { ok: true, data: null };

  const [fns, scores] = await Promise.all([
    client.data
      .from("functions")
      .select("id, name, qualified_name, file_path, category, importance, excluded, explained")
      .eq("user_id", userId)
      .eq("repo_id", repoId)
      .order("importance", { ascending: false })
      .limit(500),
    client.data.from("understanding_scores").select("function_id").eq("user_id", userId),
  ]);
  if (fns.error) return { ok: false, reason: "Couldn't load this repo's functions." };
  const reviewed = new Set((scores.data ?? []).map((s: { function_id: string }) => s.function_id));
  return {
    ok: true,
    data: {
      ...repo,
      functions: FunctionRows.parse(fns.data ?? []).map((f) => ({
        id: f.id,
        name: f.qualified_name ?? f.name,
        file: f.file_path,
        category: f.category ?? "helper",
        importance: f.importance ?? 0,
        reviewed: reviewed.has(f.id),
        eligible: !f.excluded && !f.explained,
      })),
    },
  };
}
