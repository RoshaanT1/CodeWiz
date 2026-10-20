import type { Metadata } from "next";

import { RepoPage } from "@/components/repo/repo-page";

export const metadata: Metadata = { title: "Repository · CodeWiz" };

type Props = { params: Promise<{ repoId: string }> };

export default async function RepositoryPage({ params }: Props) {
  const { repoId } = await params;
  return <RepoPage repoId={repoId} />;
}
