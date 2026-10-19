# QA and Submission

## Daily smoke test

Run this on the live site, in a private browser window, at least once a day from Tuesday.

1. Sign up a new account and set up 2FA, or sign in to a test account with its code
2. Import a sample repo
3. Start a round of 3 and finish the quiz and drill for at least one function
4. Open the results
5. Sign out, sign back in with 2FA, and check the results are still there

Log any problem as a GitHub issue with steps to reproduce it.

## Mandatory requirement checks

Do all of these on Wednesday, then again on Thursday before submitting.

| Check | How | Passes when |
|---|---|---|
| M1: AI at the core | Run a round on the live site, and point to the calls in `lib/ai/` | Questions, drills and grades appear, and the code shows live model calls |
| M2: Persistent data | Redeploy the app on Vercel, then sign back in | All repos, rounds and scores are still there |
| M3: Auth and 2FA | Create accounts A and B, set up 2FA on both, sign in with codes. While signed in as B, open A's repo and round URLs and call A's API routes | Both 2FA flows work, and B sees none of A's data anywhere |
| M4: Complete journey | Run the full smoke test in a private window | No crash anywhere on the path |
| M5: Repo and docs | Check the repo while signed out of GitHub | Public, with README, SPEC.md, AI_DISCLOSURE.md, and commits on every day from 19 to 22 October |
| M6: Code gigs | Open both gig links while signed out | Both public, with setup steps and all four teammates credited |

## Edge cases

- [ ] Bad URL, private repo, empty repo, repo with no supported files
- [ ] Huge repo: the folder picker appears
- [ ] AI timeout: a clear message, and a retry for that step only
- [ ] A drill that fails verification: that function skips its drill without breaking the round
- [ ] Page refresh in the middle of a round: it resumes at the same step
- [ ] Daily cap reached: a friendly message
- [ ] Network tab: rubrics, explanations and answer keys never arrive early
- [ ] The same account open in two tabs
- [ ] A repo file containing "ignore all previous instructions": outputs stay normal

## Before-submit checklist

- [ ] The live site works in a private window
- [ ] Two test accounts see separate data, and 2FA works
- [ ] AI features tested on the live site within the last hour
- [ ] The repo is public, with README, SPEC.md and AI_DISCLOSURE.md (and PRIOR_WORK.md if anything was reused)
- [ ] Demo video uploaded to YouTube, Vimeo or Loom (public or unlisted), 3 minutes or less
- [ ] At least two code gig links
- [ ] All four members added to the Devpost submission
- [ ] AI credits or keys will keep working until winners are announced
- [ ] The live site will stay online until winners are announced

## Devpost submission fields

- Project name and tagline
- Description: the problem, who it's for, how AI is used in the core journey, and the tech stack
- A live URL that judges can open, sign up on and use
- Demo video link
- Repo link (the same repo we pitched with)
- Links to our code gigs
- All team members

## Demo video script (3 minutes)

| Time | Show | Say |
|---|---|---|
| 0:00 | Title screen | AI writes the code, but you still have to understand it |
| 0:15 | Sign-up and 2FA setup | Every account is protected with 2FA |
| 0:40 | Paste a repo; the repo map and call map appear | CodeWiz reads every function and finds the ones that matter |
| 1:00 | Quiz on the top function, then the explanation | It checks you understand what the function does |
| 1:25 | Drill: catch two bugs, miss one, see the missed one explained | Bugs are planted in a copy, so the right answers are always known |
| 1:55 | A suggestion, and defending a choice | It asks you to justify your choices instead of just telling you what to do |
| 2:15 | Understanding score and skill profile | You see exactly which parts of your code you know |
| 2:30 | Redeploy, sign back in, data still there. A second account sees nothing | Your data is saved and private |
| 2:50 | Closing screen | Prove you understand the code you ship |

Record each section separately, then cut them together. Keep the voice-over short.

## README outline

- What CodeWiz does, in two sentences
- Live URL
- Tech stack
- How it works, in a few lines, with a link to SPEC.md
- Run it locally: prerequisites, copy `.env.example`, run the Supabase migrations, start the dev server, and the optional Semgrep service
- The code gigs we published, with links
- Team

## AI_DISCLOSURE.md outline

- **AI tools used to build it:** for example the Devmarketplace agent and coding assistants, and what we used them for
- **AI models used in the product:** provider, model, and which steps use them
- **Reused components:** every open-source library with its licence and link, any Devmarketplace gigs we used, and starter templates
- **What we wrote ourselves:** a short summary
