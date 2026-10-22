// What the browser sees of a quiz. Rubrics never appear here, and the
// explanation only appears once every question has an answer.

export type QuizItemView = {
  id: string;
  kind: "purpose" | "behaviour" | "edge_case" | "impact";
  question: string;
  answer: string | null;
  score: number | null;
  feedback: string | null;
};

export type QuizView = { items: QuizItemView[]; explanation: string | null };

export type QuizItemRow = {
  id: string;
  kind: string | null;
  question: string | null;
  answer: string | null;
  score: number | null;
  feedback: string | null;
};

const KINDS = new Set(["purpose", "behaviour", "edge_case", "impact"]);

export function toQuizView(rows: readonly QuizItemRow[], explanation: string | null): QuizView {
  const items = rows.map((row) => ({
    id: row.id,
    kind: (KINDS.has(row.kind ?? "") ? row.kind : "purpose") as QuizItemView["kind"],
    question: row.question ?? "",
    answer: row.answer,
    score: row.score,
    feedback: row.feedback,
  }));
  const done = items.length > 0 && items.every((item) => item.answer !== null);
  return { items, explanation: done ? explanation : null };
}
