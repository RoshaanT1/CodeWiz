import type { QuizPack } from "@/lib/ai/schemas/quiz-pack";

/** Everything needed to grade an answer and teach afterwards; never sent before the answer. */
export function answerKey(q: QuizPack["questions"][number], explanation: string | null) {
  return {
    ...q.rubric,
    lines: q.lines,
    correct_index: q.correct_index,
    why_correct: q.why_correct,
    best_practice: q.best_practice,
    ...(explanation ? { explanation } : {}),
  };
}
