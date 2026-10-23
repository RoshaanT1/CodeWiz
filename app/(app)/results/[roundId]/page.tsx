import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RoundReport } from "@/components/results/round-report";
import { RoundResults } from "@/components/results/round-results";
import { requireAal2User } from "@/lib/auth/session";
import { loadRoundResults } from "@/lib/scoring/load-round-results";

export const metadata: Metadata = { title: "Round results · CodeWiz" };

type Props = { params: Promise<{ roundId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ResultsPage({ params }: Props) {
  const { roundId } = await params;
  // Demo rounds have short ids; real rounds are stored with UUIDs.
  if (!UUID.test(roundId)) return <RoundResults roundId={roundId} />;

  const user = await requireAal2User(`/results/${roundId}`);
  const result = await loadRoundResults(user.id, roundId);
  if (!result.ok) throw new Error(result.reason);
  if (!result.data) notFound();
  return <RoundReport round={result.data} />;
}
