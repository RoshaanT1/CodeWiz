import type { Metadata } from "next";

import { RoundResults } from "@/components/results/round-results";

export const metadata: Metadata = { title: "Round results · CodeWiz" };

type Props = { params: Promise<{ roundId: string }> };

export default async function ResultsPage({ params }: Props) {
  const { roundId } = await params;
  return <RoundResults roundId={roundId} />;
}
