# AGENTS.md: bug planter (code gig)

This folder is published as a Devmarketplace code gig. These rules add to the root AGENTS.md. Use the `package-gig` skill before publishing.

- Import nothing from app code. The caller passes in an `llm` function (prompt and schema in, JSON out) and an optional `parse` function.
- The public API is `plantBugs(options)` in `index.ts`. It returns `{ ok: true, changedCode, bugs }` or `{ ok: false, reason }`.
- Bugs are changed in place. The changed code must have exactly as many lines as the original.
- Verification always runs: the diff touches exactly the answer-key lines, bug types come from the catalogue, the code still parses, and a second pass confirms each bug changes behaviour. Retry once, then return `ok: false`.
- The bug catalogue in `docs/ARCHITECTURE.md` is the only source of bug types.
- Tests use a fake `llm` function with fixed outputs, including deliberately wrong ones, to prove the checks reject bad results.
