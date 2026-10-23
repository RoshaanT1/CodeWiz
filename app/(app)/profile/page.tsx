import type { Metadata } from "next";

import { ProfileView } from "@/components/results/profile-view";
import { requireAal2User } from "@/lib/auth/session";
import { loadProfile } from "@/lib/scoring/load-profile";

export const metadata: Metadata = { title: "Profile · CodeWiz" };

export default async function ProfilePage() {
  const user = await requireAal2User("/profile");
  const result = await loadProfile(user.id);
  if (!result.ok) throw new Error(result.reason);
  const name = typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : (user.email?.split("@")[0] ?? "Your profile");
  return <ProfileView name={name} email={user.email ?? ""} profile={result.data} />;
}
