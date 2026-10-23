export type ChoiceResult = { score: 0 | 2; feedback: string };

/** Grades a multiple-choice pick in code: 2 for the correct option, 0 otherwise. */
export function gradeChoice(choice: number, correctIndex: number, options: readonly string[], whyCorrect: string): ChoiceResult {
  if (choice === correctIndex) return { score: 2, feedback: `Correct. ${whyCorrect}` };
  const right = options[correctIndex] ?? "";
  return { score: 0, feedback: `Not quite. The answer is "${right}". ${whyCorrect}` };
}
