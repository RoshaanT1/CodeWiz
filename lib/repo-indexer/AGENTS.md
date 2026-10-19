# AGENTS.md: repo indexer (code gig)

This folder is published as a Devmarketplace code gig. These rules add to the root AGENTS.md. Use the `package-gig` skill before publishing.

- Import nothing from `app/`, `components/`, `lib/supabase/`, `lib/server/` or database types. Take the token, limits and options as parameters.
- No framework code. It must run in any Node.js project.
- The public API is `indexRepo(options)` in `index.ts`, with exported types. If it changes, update this folder's `README.md` and `docs/GIGS.md`.
- Never execute repo code. Parse it with tree-sitter only.
- Respect the limits in `docs/ARCHITECTURE.md` (file count, file size, parallel requests), and handle trees that GitHub marks as `truncated`.
- Keep this folder's `README.md` current: install, setup, usage example, limits, dependencies with licences, contributors.
- Unit tests sit next to the code and use small fixture files, not live GitHub calls.
