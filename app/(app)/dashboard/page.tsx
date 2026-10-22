import type { Metadata } from "next";

import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import { requireAal2User } from "@/lib/auth/session";
import { loadWorkspace } from "@/lib/quiz/load-workspace";

export const metadata: Metadata = { title: "Dashboard · CodeWiz" };

export default async function DashboardPage() {
  const user = await requireAal2User("/dashboard");
  const result = await loadWorkspace(user.id);
  if (!result.ok) throw new Error(result.reason);
  const name =
    typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : (user.email?.split("@")[0] ?? "there");
  return <LiveDashboard name={name} repos={result.data.repos} rounds={result.data.rounds} />;
}
