# CLAUDE.md

@AGENTS.md

Claude Code: the project instructions are in AGENTS.md, imported above, so there is one source of truth for every agent. Project skills live in `.agents/skills/`. If Claude Code doesn't pick them up, link them once from the repo root:

`mkdir -p .claude && ln -s ../.agents/skills .claude/skills`
