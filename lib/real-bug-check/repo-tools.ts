import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { RealBugTools, ToolFunction } from "./check-flag";

type Row = { id: string; name: string; qualified_name: string | null; file_path: string; start_line: number; end_line: number; code: string };
const COLUMNS = "id, name, qualified_name, file_path, start_line, end_line, code";

/**
 * The real-bug check's tools, backed by the user's indexed functions (Row
 * Level Security applies). The model only ever sees short aliases.
 */
export function makeRepoTools(db: SupabaseClient, userId: string, repoId: string) {
  const aliasById = new Map<string, string>();
  const idByAlias = new Map<string, string>();
  const aliasOf = (id: string) => {
    let alias = aliasById.get(id);
    if (!alias) {
      alias = `f${aliasById.size + 1}`;
      aliasById.set(id, alias);
      idByAlias.set(alias, id);
    }
    return alias;
  };
  const toFunction = (row: Row): ToolFunction => ({
    alias: aliasOf(row.id),
    name: row.qualified_name ?? row.name,
    file: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    code: row.code,
  });

  const tools: RealBugTools = {
    async getFunction(alias) {
      const id = idByAlias.get(alias);
      if (!id) return null;
      const { data } = await db.from("functions").select(COLUMNS).eq("id", id).eq("user_id", userId).eq("repo_id", repoId).maybeSingle<Row>();
      return data ? toFunction(data) : null;
    },
    async getCallers(alias) {
      const id = idByAlias.get(alias);
      if (!id) return [];
      const { data: links } = await db.from("function_calls").select("caller_id").eq("user_id", userId).eq("callee_id", id).limit(10);
      const ids = (links ?? []).map((l: { caller_id: string }) => l.caller_id);
      if (ids.length === 0) return [];
      const { data } = await db.from("functions").select("id, name, qualified_name, file_path").eq("user_id", userId).in("id", ids);
      return (data ?? []).map((r: Pick<Row, "id" | "name" | "qualified_name" | "file_path">) => ({
        alias: aliasOf(r.id),
        name: r.qualified_name ?? r.name,
        file: r.file_path,
      }));
    },
    async search(text) {
      const needle = text.slice(0, 60);
      const pattern = `%${needle.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const { data } = await db.from("functions").select(COLUMNS).eq("user_id", userId).eq("repo_id", repoId).ilike("code", pattern).limit(8);
      return ((data ?? []) as Row[]).flatMap((row) => {
        const lines = row.code.split("\n");
        const index = lines.findIndex((line) => line.toLowerCase().includes(needle.toLowerCase()));
        if (index === -1) return [];
        return [{ alias: aliasOf(row.id), name: row.qualified_name ?? row.name, file: row.file_path, line: row.start_line + index, text: lines[index] ?? "" }];
      });
    },
  };

  return { tools, aliasOf, idOf: (alias: string) => idByAlias.get(alias), toFunction };
}
