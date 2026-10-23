// What the browser sees of a quiz. Rubrics and the correct option never
// appear before an answer, and the explanation only once every question has one.

export type QuizItemView = {
  id: string;
  kind: "purpose" | "behaviour" | "edge_case" | "impact";
  question: string;
  answer: string | null;
  score: number | null;
  feedback: string | null;
  /** The 4 multiple-choice options, or null for quizzes made before options existed. */
  options: string[] | null;
  /** Revealed only after this question is answered. */
  correctOption: number | null;
  /** Industry-standard tip, revealed only after this question is answered. */
  recommendation: string | null;
};

export type QuizView = { items: QuizItemView[]; explanation: string | null };

export type QuizItemRow = {
  id: string;
  kind: string | null;
  question: string | null;
  answer: string | null;
  score: number | null;
  feedback: string | null;
  options?: unknown;
  correct_option?: number | null;
  recommendation?: string | null;
};

const KINDS = new Set(["purpose", "behaviour", "edge_case", "impact"]);

export function toQuizView(rows: readonly QuizItemRow[], explanation: string | null): QuizView {
  // Sorted by id so the order is the same on first load and after a reload.
  const items = [...rows].sort((a, b) => a.id.localeCompare(b.id)).map((row) => ({
    id: row.id,
    kind: (KINDS.has(row.kind ?? "") ? row.kind : "purpose") as QuizItemView["kind"],
    question: row.question ?? "",
    answer: row.answer,
    score: row.score,
    feedback: row.feedback,
    options: Array.isArray(row.options) && row.options.length === 4 && row.options.every((o) => typeof o === "string") ? (row.options as string[]) : null,
    // Belt and braces: never send the answer key for an unanswered question.
    correctOption: row.answer !== null ? (row.correct_option ?? null) : null,
    recommendation: row.answer !== null ? (row.recommendation ?? null) : null,
  }));
  const done = items.length > 0 && items.every((item) => item.answer !== null);
  return { items, explanation: done ? explanation : null };
}
