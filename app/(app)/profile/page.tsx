import type { Metadata } from "next";

import { Profile } from "@/components/results/profile";
import { ProfileView } from "@/components/results/profile-view";
import { requireAal2User } from "@/lib/auth/session";
import { loadProfile } from "@/lib/scoring/load-profile";

export const metadata: Metadata = { title: "Profile · CodeWiz" };

export default async function ProfilePage() {
  const user = await requireAal2User("/profile");
  const result = await loadProfile(user.id);
  if (!result.ok) throw new Error(result.reason);
  // Until the user has real rounds, show the demo profile.
  if (!result.data) return <Profile />;

  const name = typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : (user.email ?? "Your profile");
  return <ProfileView name={name} email={user.email ?? ""} profile={result.data} />;
}
