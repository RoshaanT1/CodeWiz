import type { Metadata } from "next";

import { Profile } from "@/components/results/profile";

export const metadata: Metadata = { title: "Profile · CodeWiz" };

export default function ProfilePage() {
  return <Profile />;
}
