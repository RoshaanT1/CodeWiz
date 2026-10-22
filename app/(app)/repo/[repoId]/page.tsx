import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LiveRepo } from "@/components/repo/live-repo";
import { RepoPage } from "@/components/repo/repo-page";
import { requireAal2User } from "@/lib/auth/session";
import { loadRepo } from "@/lib/quiz/load-workspace";

export const metadata: Metadata = { title: "Repository · CodeWiz" };

type Props = { params: Promise<{ repoId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RepositoryPage({ params }: Props) {
  const { repoId } = await params;
  // Demo repos have short ids; imported repos are stored with UUIDs.
  if (!UUID.test(repoId)) return <RepoPage repoId={repoId} />;

  const user = await requireAal2User(`/repo/${repoId}`);
  const result = await loadRepo(user.id, repoId);
  if (!result.ok) throw new Error(result.reason);
  if (!result.data) notFound();
  return <LiveRepo repo={result.data} />;
}
