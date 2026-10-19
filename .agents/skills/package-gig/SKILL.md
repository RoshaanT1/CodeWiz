---
name: package-gig
description: Use right after finishing a code gig trigger task (AUTH-3, PARSE-5, AI-1, DRILL-3, MAP-2 or LIB-2), or when asked to prepare or check a Devmarketplace code gig. Prepares everything for the Add your Gigs form and tells the human it's ready, without being asked.
---

# Package a code gig

Gig names, trigger tasks, folders and pre-written form text are in `docs/GIGS.md`. Read only the section for this gig.

## Steps

1. **Check the code lifts out.** Gig code imports nothing from `app/`, `lib/supabase/`, `lib/server/`, shared components or database types. Fix any imports by passing values in as parameters. Gig 3 (2FA) is the exception, because it's about the app setup itself: list the files it spans instead.
2. **Check the public API.** `index.ts` (or `lib/ai/call-json.ts` for gig 4) exports only the public API and its types, matching `docs/GIGS.md`.
3. **Check it runs.** At least one test or example runs without secrets.
4. **Write the README** in the gig folder. For gig 3, which spans several folders, write it as a README section inside `docs/gigs/supabase-totp-2fa.md`. Sections: what it does, install, setup, usage example, options and limits, dependencies with licences and links, and Contributors (Roshaan Tahir, M Hammad Khan, Fizzah Abdullah, Hammad Khan).
5. **Pick the code snippet.** 15 to 40 lines that show the gig best, usually the README's usage example. No secrets, tokens or project-specific URLs. Note the language for the form's dropdown.
6. **Write `docs/gigs/<slug>.md`** with the full GIG READY block below. The slug matches the thumbnail file name.
7. **Update the tracker** in `docs/GIGS.md`: set the status to Ready and add the commit hash.
8. **End your reply with the GIG READY block.** Don't wait to be asked.

## The GIG READY block

Follow the form's field order. Count characters exactly: the title must be 50 characters or fewer, the description 200 or fewer. Use the pre-written text from `docs/GIGS.md` unless the code changed what the gig does.

    GIG READY: <gig name>
    Publish at Devmarketplace → Add your Gigs

    1. Thumbnail
       Upload docs/gigs/thumbnails/<slug>.png

    2. Basic Info
       Title (<n>/50): <title>
       Description (<n>/200): <description>

    3. Tech Stack
       Skills (pick the closest ones in the list): <skills>
       Custom tags (<n>/10, press Enter after each): <tags>

    4. Code Snippet
       Language: <language to choose in the dropdown>
       From: <file path>, lines <a> to <b>
       <the snippet, in a code block>

    5. Read ME
       Open <README path> on GitHub, copy the rendered page and paste it into the editor.

    6. After you click Create
       Add the gig link to the tracker in docs/GIGS.md and to the Devpost draft.

## Check before saying it's ready

- [ ] A developer could use the gig from the README alone
- [ ] No secrets, tokens or hard-coded URLs anywhere in the gig
- [ ] The test or example passes
- [ ] The title and description are within the limits
- [ ] Only our own code is included; open-source code is linked, not pasted
