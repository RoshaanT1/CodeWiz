import { z } from "zod";

/** AI contract H: nothing, or one library that already does what the function does. */
export const LibrarySuggestionSchema = z.object({
  suggestion: z
    .object({
      ecosystem: z.enum(["npm", "pypi", "python_stdlib"]),
      package: z.string().min(1).max(214),
      function: z.string().min(1).max(100),
      docs_url: z.string().max(500),
      why: z.string().min(10).max(600),
    })
    .nullable(),
});

export type LibrarySuggestionOutput = z.infer<typeof LibrarySuggestionSchema>;
