# CodeWiz

**Prove you understand the code you ship.**

CodeWiz is a web app that maps your own GitHub repo, quizzes you on its key functions, and runs spot-the-bug drills on a copy of your code. It is built for students and junior developers who code with AI.

## 1. Problem

Developers now depend on AI-written code they don't fully trust. The 2025 Stack Overflow Developer Survey drew more than 49,000 responses from 177 countries [1]. Of those developers, 84% use or plan to use AI tools, yet 46% don't trust the accuracy of the output. The top frustration, named by 66%, was AI output that is "almost right, but not quite."

Almost-right code is where the risk sits: the bug is small, plausible and easy to miss. This hackathon's own brief makes the same point: generating code is easy now, while steering and verifying it is the hard part [2].

Students and junior developers face specific gaps:

- They submit AI-written code they can't explain in vivas, project defences and interviews.
- Assignments check whether code runs, not whether its author can find a flaw in it.
- Code review is a core job skill, but few students practise it on purpose.
- AI review tools review code for them, so their own judgement never improves.
- Generic practice problems have nothing to do with the code they actually write.

## 2. Users

**Primary:** CS and software engineering students, and junior developers, who use AI assistants and need to explain, defend or review code before a viva, a project defence, an internship code review or a technical interview.

**After the hackathon:**

- Professional developers and teams who want to understand AI-generated code before they push it. A pre-merge check would quiz them on the functions a pull request changes.
- Instructors who want an objective signal of whether students understand the code they submit.

## 3. How it works

CodeWiz reads a public GitHub repo, maps which functions call which, and picks the functions that matter most. For each one, it quizzes you, hides bugs in a copy for you to find, and asks you to defend your design choices against its suggestions. Everything feeds one understanding score per function, so you can see exactly which parts of your code you really know.

Planting synthetic bugs on purpose, known as bug seeding, is an established technique in software engineering research [3]. CodeWiz uses it to train people rather than test suites. Because CodeWiz plants the bugs, the right answers are always known, so grading is fair.

CodeWiz never runs repo code and never changes your repo. Drills always work on a copy inside the app. It is not a code generator, an automated code reviewer or a plagiarism checker.

## 4. Core user journey

This is the path judges will test end to end.

1. **Sign up** with email and password, then turn on 2FA with an authenticator app.
2. **Add code:** paste any public GitHub repo URL, or pick one of three sample repos.
3. **See the repo map:** CodeWiz parses every function, builds the call map and ranks functions by importance.
4. **Start a round** of 3 functions (or 5 or 10). For each function:
    1. **Quiz:** answer 2 to 3 questions about what it does, why, and how it behaves at the edges, then read a plain-language explanation of the function.
    2. **Drill:** review a copy with 1 to 3 hidden bugs, flag the lines you think are wrong and explain why.
    3. **Defend your choices:** see best-practice, security and library suggestions, and say whether you agree. If you don't, explain why.
5. **See results:** quiz feedback, bugs caught and missed with fixes, how your reasoning held up, and an understanding score for each function.
6. **Come back:** sign out and back in. Rounds, scores and repo coverage are still there, and the next round targets your weak spots.

## 5. Features

### Core

1. **Repo map**
    - Imports any public GitHub repo without downloading it whole
    - Parses every Python, JavaScript and TypeScript function with exact line ranges, skipping dependencies, build output, data files and tests
    - Shows each function's callers and callees as a call map
    - Ranks functions by number of callers, data access (database, network, files) and amount of logic. AI makes the final pick and says why, for example "9 functions depend on this"
    - Guardrails: no repeats, a spread across categories, trivial functions skipped, and a folder picker for very large repos
2. **Function quiz**
    - AI writes questions grounded in the function and its callers
    - Answers are scored 0 to 2 against a rubric tied to the actual code, with feedback
    - After answering, the user sees a plain-language explanation of what the function does, as the model answer. It is never shown before the quiz, so it can't give the answers away, and it is labelled as AI-generated
    - Functions outside the current round can be explained at any time
3. **Bug drills**
    - Bugs come from a fixed catalogue that includes security bugs: off-by-one errors, wrong conditions, missing null checks, unchecked user input, swallowed errors, wrong return values, async mistakes and mutable default arguments
    - Every drill has an answer key that code verifies before the drill is shown
    - A flag on or next to a planted line counts as a catch, and AI scores the explanation
    - If a user flags a real bug that was already in the code, AI checks it with tools (callers, existing guards) and shows it with evidence, labelled "possible"
4. **Understanding score**
    - One score per function, combining quiz, drill and defend-your-choice results
    - A skill profile by bug type and a coverage view of the repo
    - Round size of 3, 5 or 10 functions

### Extras (built once the core journey works on the live URL)

5. **Best practices and security:** Semgrep scans the round's functions, AI explains each finding in plain words, and the user says whether they agree.
6. **Library check:** AI points out when a function repeats something a well-known library already does. A suggestion is only shown if the package is confirmed on the npm or PyPI registry, with a link to its docs. The user says whether switching is better, and why not if they disagree.
7. **Code metrics:** length, branching and number of callers, measured by the parser, with AI explaining what the numbers mean. There is no AI opinion score for the code itself.

**Defend your choice:** every suggestion in 5 and 6 is a question, not a verdict. A well-reasoned disagreement earns full credit, so users are never punished when the AI is wrong.

## 6. How AI is used

The model writes every question, drill, explanation and grade. Regular code checks the model's work wherever there is a right answer to check against.

| Step | What happens | Done by |
|---|---|---|
| 1. Import | Fetch the repo tree from GitHub and keep supported files under size limits | Code |
| 2. Index | Parse functions, build the call map, measure length, branching and callers | Code |
| 3. Select | Pick functions from the top-ranked shortlist, with a one-line reason each | AI, checked by code |
| 4. Quiz | Write questions, rubrics and a plain-language explanation in one call, then score answers against the code | AI |
| 5. Plant | Rewrite each function with 1 to 3 catalogue bugs and return an answer key as JSON | AI |
| 6. Verify | The diff must touch exactly the key's lines and the code must still parse. A second pass confirms each bug changes behaviour. Failures are regenerated once, then dropped | Code and AI |
| 7. Grade drills | Match flags to planted lines, score explanations, and check unmatched flags for real bugs with tool evidence | Code and AI |
| 8. Suggest | Run Semgrep and explain findings; propose library replacements and confirm the package in its registry | Tools and AI |
| 9. Defend | Score the user's reasons for agreeing or disagreeing | AI |
| 10. Score | Combine results into the understanding score and update the skill profile | Code |

**When the AI fails:** every output is validated against a JSON schema and retried once. Line numbers and function boundaries come from the parser, not the model. Claims of real bugs need tool evidence. Answer keys stay on the server until the user submits. Each function is generated in its own request, so one slow call can't stall a round.

## 7. Data model

PostgreSQL on Supabase. Row Level Security limits every row to its owner, and child rows inherit ownership through their repo or round.

| Table | Key fields |
|---|---|
| `profiles` | `id` (auth user), `display_name`, `created_at` |
| `repos` | `id`, `user_id`, `url`, `name`, `commit_sha`, `created_at` |
| `functions` | `id`, `repo_id`, `file_path`, `name`, `start_line`, `end_line`, `language`, `length`, `branches`, `callers`, `category`, `importance`, `explanation` |
| `function_calls` | `repo_id`, `caller_id`, `callee_id` |
| `rounds` | `id`, `user_id`, `repo_id`, `size`, `status`, `created_at`, `submitted_at` |
| `round_functions` | `round_id`, `function_id`, `selection_reason` |
| `quiz_items` | `id`, `round_id`, `function_id`, `question`, `rubric`, `answer`, `score`, `feedback` |
| `drills` | `id`, `round_id`, `function_id`, `changed_code` |
| `planted_bugs` | `id`, `drill_id`, `line_start`, `line_end`, `bug_type`, `explanation`, `fix` (server-only until submission) |
| `findings` | `id`, `drill_id`, `line`, `comment`, `outcome`, `explanation_score`, `feedback` |
| `suggestions` | `id`, `round_id`, `function_id`, `kind`, `detail`, `evidence`, `user_verdict`, `user_reason`, `reason_score` |
| `understanding_scores` | `user_id`, `function_id`, `score`, `updated_at` |
| `skill_scores` | `user_id`, `bug_type`, `attempts`, `caught`, `updated_at` |

## 8. Technical approach

| Layer | Choice |
|---|---|
| App | Next.js (App Router, TypeScript) on Vercel. All model and GitHub calls run in server routes |
| Database and auth | Supabase: Postgres, Auth with TOTP 2FA, Row Level Security |
| AI | A frontier model from the event credits (Claude or GPT) behind a small wrapper with zod schema checks and retries |
| Parsing | tree-sitter (WebAssembly build) for Python, JavaScript and TypeScript |
| GitHub | REST API through Octokit with a server-side token. Snapshots are cached by commit SHA |
| Verification | jsdiff and parse checks |
| Security scanning | Semgrep in a small FastAPI service, called only by the Next.js server |
| Library check | npm and PyPI registry APIs |
| Interface | shadcn/ui, Shiki for syntax highlighting, React Flow for the call map |

**Limits:** public repos only; Python, JavaScript and TypeScript; capped files per repo; a daily round cap per user to protect AI credits.

## 9. Mandatory requirements

| Requirement | How CodeWiz meets it |
|---|---|
| M1: AI at the core | Every question, drill, explanation and grade comes from live model calls, with validation around them |
| M2: Persistent data | Repos, functions, rounds, answers, findings, suggestions and scores live in Supabase Postgres |
| M3: Auth with 2FA | Supabase Auth with TOTP, Row Level Security on every table, tested with two accounts |
| M4: Complete journey | Sign up → import a repo → complete a round → results saved → sign back in and see them |
| M5: Repo and docs | README, SPEC and AI_DISCLOSURE, with commits every day from 19 to 22 October |
| M6: Two code gigs | See section 10 |

## 10. Code gigs

Both are written during the event and published as soon as they work, with setup steps and every teammate credited.

1. **GitHub repo indexer** (target: Tuesday): takes a public repo URL and returns its functions with line ranges, metrics and a call map.
2. **Verified bug planter** (target: Wednesday): takes a function and returns a changed copy and a verified answer key, with automatic retry.

Backups: a Supabase TOTP 2FA starter for the Next.js App Router, or a registry-verified library lookup.

## 11. Build plan

The four of us work in parallel. Each row is what must be working on the live URL by that point.

| By | Working on the live URL | Why then |
|---|---|---|
| Mon 19, 1 PM | Sign-up, sign-in, repo import, parsing, deployed skeleton | Required kickoff checkpoint, shown in the Devmarketplace workspace |
| Mon 19, night | 2FA, database schema and Row Level Security | Everything after depends on it |
| Tue 20 | Repo map, call map view, function quiz; gig 1 published | First half of the core journey |
| Wed 21 | Bug drills, grading, understanding score; gig 2 published; two-account test | Completes the core journey (M4) |
| Thu 22 | Semgrep, library check, metrics, polish, restart test, README, AI_DISCLOSURE, demo video | Extras land last, so a slip never breaks the core. Submit by 8 PM, three hours before the 11 PM freeze |

## 12. Team

| Member | Owns |
|---|---|
| Roshaan Tahir | Bug drills and scoring: AI wrapper, bug planting and verification, drill grading, results, understanding score, skill profile, library check; code gigs 2 and 4 |
| M Hammad Khan | Repo analysis and selection: GitHub import, parsing and call map data, ranking, AI function selection, the real-bug check with tool calls, database and access rules, Semgrep service; code gig 1 |
| Fizzah Abdullah | App, auth and quiz: skeleton and deployment, sign-up and 2FA, repo page and call map, round flow, quiz generation and grading with explanations, "defend your choice"; code gigs 3 and 6 |
| Hammad Khan | QA, docs and demo: sample repos, the daily test checklist (two accounts, 2FA, restart), README, AI_DISCLOSURE, Devpost write-up, demo video, questions to organisers on Discord |

## 13. Reuse plan

- **Open source** (no declaration needed; all listed with licences in AI_DISCLOSURE.md): Next.js, Supabase client libraries, tree-sitter, Octokit, jsdiff, zod, Semgrep, FastAPI, shadcn/ui, Shiki, React Flow.
- **Devmarketplace:** at kickoff we'll search for existing auth/2FA and GitHub-import gigs and reuse them where they fit.
- **AI assistants** used while building are listed in AI_DISCLOSURE.md.
- **Prior work:** none planned. If that changes, we'll declare it in PRIOR_WORK.md at kickoff.

## 14. Risks

| Risk | Mitigation |
|---|---|
| The model gets line numbers wrong or plants a "bug" that changes nothing | Parser boundaries, diff and parse checks, a second-pass check; regenerate once, then drop |
| Quiz grading feels arbitrary | A rubric tied to the code, shown with every score; drills carry the objective part of the score |
| AI suggests a library function that doesn't exist | Shown only after the package is confirmed in its registry, with a docs link |
| Huge or unusual repos | File caps, language filter, folder picker, sample repos |
| 2FA or data isolation breaks | Managed TOTP; two-account test on Wednesday, not Thursday |
| Semgrep service fails or runs late | It's an extra: security bug types in the drills still teach the same lessons |
| AI credits run out before winners are announced | Daily round cap, usage monitoring, and confirming early how long event credits last |

## 15. Demo plan (3 minutes)

| Time | Shows |
|---|---|
| 0:00 | The problem in one line |
| 0:15 | Sign-up and 2FA setup |
| 0:40 | Paste a repo; the repo map and call map appear |
| 1:00 | Quiz on the top function, with feedback and the plain-language explanation |
| 1:25 | Drill: catch two bugs, miss one; the missed bug explained |
| 1:55 | A library suggestion, and the user defends their choice |
| 2:15 | Understanding score and skill profile update |
| 2:30 | Restart the app and sign back in: data is still there. A second account sees none of it |
| 2:50 | Close |

## Sources

1. InfoWorld coverage of the 2025 Stack Overflow Developer Survey (July 2025): https://www.infoworld.com/article/4031673/ai-use-among-software-developers-grows-but-trust-remains-an-issue-stack-overflow-survey.html
2. Build The Next Big Thing with AI hackathon brief, Devmarketplace x NED University (Devpost)
3. "Analyzing a Semantics-Aware Bug Seeding Tool's Efficacy: A qualitative study with the SemSeed tool": https://sol.sbc.org.br/index.php/sbes/article/view/28293
