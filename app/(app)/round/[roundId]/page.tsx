import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LiveRound } from "@/components/round/live-round";
import { RoundWorkflow } from "@/components/round/round-workflow";
import { requireAal2User } from "@/lib/auth/session";
import { loadLiveRound } from "@/lib/quiz/load-round";

export const metadata: Metadata = { title: "Practice round · CodeWiz" };

type Props = { params: Promise<{ roundId: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RoundPage({ params }: Props) {
  const { roundId } = await params;
  // Demo rounds have short ids. Keyed so moving to another round starts from its first function.
  if (!UUID.test(roundId)) return <RoundWorkflow key={roundId} roundId={roundId} />;

  const user = await requireAal2User(`/round/${roundId}`);
  const result = await loadLiveRound(user.id, roundId);
  if (!result.ok) throw new Error(result.reason);
  if (!result.data) notFound();
  if (result.data.status === "completed") redirect(`/results/${roundId}`);
  return <LiveRound key={roundId} round={result.data} />;
}
