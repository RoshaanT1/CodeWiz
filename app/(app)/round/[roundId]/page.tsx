import type { Metadata } from "next";

import { RoundWorkflow } from "@/components/round/round-workflow";

export const metadata: Metadata = { title: "Practice round · CodeWiz" };

type Props = { params: Promise<{ roundId: string }> };

export default async function RoundPage({ params }: Props) {
  const { roundId } = await params;
  // Keyed so moving to another round starts from its first function.
  return <RoundWorkflow key={roundId} roundId={roundId} />;
}
