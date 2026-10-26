# Mann Ki Baat Explained

An independent, unofficial explainer for the monthly Mann Ki Baat radio address,
in English, Hindi and five other Indian languages. Static Astro site hosted on GitHub Pages.
Not affiliated with the Government of India or All India Radio.

    npm install
    npm test
    npm run build

## How it works

The site code never changes from month to month. Each episode is one data file,
`content/episodes/YYYY-MM.json`, plus any scheme records in `content/schemes/<id>.json`. A push
to `main` runs `.github/workflows/deploy.yml`, which tests, builds and deploys to Pages.

A Claude Code scheduled routine creates the data file each month, with no human review. It runs
daily at 11:30 IST from the 26th to the 4th of the next month, and follows
[`pipeline/ROUTINE.md`](pipeline/ROUTINE.md):

1. `npm run pipeline -- should-run`: stops if outside the window or the month already exists.
2. `npm run pipeline -- discover <month>`: finds the official English and Hindi transcripts on
   pmindia.gov.in.
3. `npm run pipeline -- save-sources <month> <enUrl> <hiUrl>`: saves them unaltered to
   `sources/<month>/` (HTML, numbered paragraphs, `meta.json` with hashes).
4. Writes the episode and scheme JSON following
   [`pipeline/EXTRACT_RULES.md`](pipeline/EXTRACT_RULES.md): verbatim quotes, every fact cited
   to a paragraph, schemes `full` only from official pages.
5. `npm run validate:content -- <month>`: schema, verbatim quotes, sources, link health,
   languages, no-guessing and sanity checks (up to 3 fix-and-retry rounds, content only).
6. `npm run pipeline -- publish <month>`: re-validates, then commits `content/` and `sources/`
   to `main` if every check passes, or pushes everything to a `drafts/<month>` branch if not.
7. Waits for the page to go live, then emails the owner using
   [`pipeline/notify.md`](pipeline/notify.md): live, not published, or no transcript found
   (sent on the 4th only). A repeated failure is emailed only when the failing checks change,
   plus once on the 4th; fetch and setup failures are emailed on the 4th only.

Commits made by the routine use the identity `Mann Ki Baat Routine
<yawdor@users.noreply.github.com>` (set per command by `pipeline/publish.ts`).

The routine may only write to `content/`, `sources/` and `reports/`.

## Where things go

| What | Where |
|---|---|
| Official transcripts (evidence, never edited) | `sources/<month>/` on `main` (and on the draft branch) |
| Published episode | `content/episodes/<month>.json` on `main` |
| Scheme records | `content/schemes/<id>.json` |
| Validation report | `reports/<month>.content.json`: local only (git-ignored) after a successful run; committed on the `drafts/<month>` branch when a run fails |
| Failed drafts | Branch `drafts/<month>` on GitHub, with the content and the report |

## Run a month by hand

Use this if the routine is down, a transcript appeared after the 4th, or the routine missed
the 4th (an outage: no Missing or final Failure email is sent then). On a clean `main`:

    git checkout main
    git pull --ff-only
    npm ci
    npm run pipeline -- discover 2026-10
    npm run pipeline -- save-sources 2026-10 <enUrl> <hiUrl>
    # write content/episodes/2026-10.json (and schemes) following pipeline/EXTRACT_RULES.md,
    # or ask Claude Code to "follow pipeline/ROUTINE.md for 2026-10"
    npm run validate:content -- 2026-10
    npm run pipeline -- publish 2026-10 --dry-run   # shows the git commands it would run
    npm run pipeline -- publish 2026-10

`should-run` only says yes inside the 26th–4th window; outside it, start at `discover`. To test
the window logic, pass a time: `npm run pipeline -- should-run --now 2026-10-26T06:00:00Z`.

## Roll back a month

Every published month is a single commit on `main` named
`content: Mann Ki Baat <Month YYYY> (episode N)`. To take it down:

    git log --oneline -- content/episodes/2026-10.json   # find the episode commit
    git revert <episode commit>
    git push origin main

The deploy rebuilds the site without that month. Reverting removes the episode file, so if you
are still inside the 26th–4th window the routine will try that month again on its next run.

## Fix a month

- **A published month has a mistake:** edit `content/episodes/<month>.json` (or the scheme
  file), run `npm run validate:content -- <month>`, and commit to `main` once it prints `OK`.
  Or ask Claude Code to fix that month following `pipeline/EXTRACT_RULES.md`.
- **A month went to drafts:** read `reports/<month>.content.json` on the `drafts/<month>` branch
  for the failed checks. On `main`, bring the files over
  (`git checkout origin/drafts/<month> -- content sources`), fix the content, re-run
  `npm run validate:content -- <month>` until it prints `OK`, then run
  `npm run pipeline -- publish <month>`.
- **The site did not deploy:** see the Deploy workflow under GitHub Actions. The previous site
  stays live until a deploy succeeds.
