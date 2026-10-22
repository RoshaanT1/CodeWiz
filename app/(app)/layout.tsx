import type { User } from "@supabase/supabase-js";

import { AppShell } from "@/components/app-shell/app-shell";
import {
  WorkspaceProvider,
  type WorkspaceUser,
} from "@/components/app-shell/workspace-provider";
import { requireAal2User } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Always render per request: every page here depends on the session cookie.
export const dynamic = "force-dynamic";

function toWorkspaceUser(user: User): WorkspaceUser {
  const email = user.email ?? "";
  const meta: unknown = user.user_metadata?.full_name;
  const name =
    typeof meta === "string" && meta.trim() ? meta.trim() : email.split("@")[0] || "You";
  const words = name.split(/[\s._-]+/).filter(Boolean);
  const initials = (
    words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2)
  ).toUpperCase();
  const created = new Date(user.created_at);
  const joined = Number.isNaN(created.getTime())
    ? "Joined recently"
    : `Joined ${new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(created)}`;
  return { name, email, initials, joined };
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side check on top of the middleware: no shell content is sent
  // until the visitor is signed in with a completed 2FA session.
  const user = await requireAal2User("/dashboard");

  // The sidebar lists the user's real repos. A failed read shows an empty list.
  const client = await createClient();
  const { data } = client.ok
    ? await client.data.from("repos").select("id, name").eq("user_id", user.id).eq("status", "indexed").order("created_at", { ascending: false }).limit(20)
    : { data: null };
  const repos = (data ?? []) as { id: string; name: string }[];

  return (
    <WorkspaceProvider user={toWorkspaceUser(user)}>
      <AppShell repos={repos}>{children}</AppShell>
    </WorkspaceProvider>
  );
}
