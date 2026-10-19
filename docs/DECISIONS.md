# Decisions

What we decided, and why. Change a decision only after the team agrees, and add a row here when you do.

| Area | Decision | Why |
|---|---|---|
| Problem | Developers, especially students, ship AI-written code they can't explain or review | Backed by the 2025 Stack Overflow survey (see SPEC.md) and the hackathon's own brief |
| Users | Students and junior developers first; professional developers after the hackathon | One clear user scores better in judging |
| Name | CodeWiz | The repo already exists, and earlier names clashed with existing products |
| Core loop | Quiz → explanation → bug drill → results, feeding an understanding score per function | Tests understanding from two sides: explaining the code and spotting faults in it |
| Bug drills | AI plants bugs in a copy of the code, changing lines in place, and code verifies them before they're shown | Planted bugs give a known right answer, so grading is fair |
| Real bugs | Checked only when a user flags a line that wasn't planted, with tool evidence, and labelled "possible" | A full "is this code correct" analyser is crowded and can't be verified in 4 days |
| Function selection | Parse every function, build an approximate call map, rank by importance, and let AI pick from the top with a reason | Better challenges than random sampling, and cheap because the AI only sees a shortlist |
| Data flow | Shown as a call map (who calls whom), not true data-flow analysis | Honest about what a parser can do in 4 days |
| Round size | 3 by default, with 5 or 10 as options | Short rounds, generated progressively |
| Code rating | No AI opinion score for the code. We score the user's understanding and show measured metrics | Opinions can't be defended to judges; measurements can |
| Suggestions | Best-practice, security and library suggestions are questions, not verdicts. A reasoned disagreement earns full credit | Users aren't punished when the AI is wrong |
| Explanations | Shown only after the quiz. A function explained on request is left out of future quizzes | Otherwise the explanation gives away the answers |
| Safety | Never run repo code, never change the user's repo, public repos only | Security and scope |
| Stack | One Next.js app on Vercel, with Supabase for auth, 2FA and the database. Semgrep runs in a separate Python service | One deployment for the core; Semgrep can't run inside a Next.js function |
| Scope | Core first. Extras (Semgrep, library check, metrics panel) sit behind feature flags, and Semgrep is the first to cut | The judges said a finished MVP beats many half-built features |
| Framing | A global problem, not tied to one country | A wider market, and the platform's owner is US-based |
| Code gigs | Six planned, two required, each tied to a trigger task. The agent prepares the form content automatically and a human publishes it | Gigs are judged and must be published during the build, not at the end |
| Team split | Three equal feature slices, each with its own AI steps: Roshaan on drills and scoring, M Hammad on repo analysis and selection, Fizzah on the app, auth and quiz. Hammad Khan on testing, docs and publishing gigs | Everyone works in parallel on separate folders, and the AI work is shared fairly |
| Workflow | Personal forks, pull requests into `RoshaanT1/CodeWiz`, merge commits rather than squash, and folder ownership | Parallel work with few conflicts, and a history that shows everyone's commits across all four days |
