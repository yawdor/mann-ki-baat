# Notification templates

The routine (`pipeline/ROUTINE.md`) sends **at most one email per run**, using exactly one of the
templates below. A run that exits quietly (outside the window, already published, or no
transcript yet before day 4) sends nothing.

## How to send

- **To:** `pandith.ajith@gmail.com` (the only recipient; no cc or bcc).
- **Tool:** the Gmail connector's `send_message` tool (in Claude Code it appears as
  `mcp__claude_ai_Gmail__send_message`). Pass `to: ["pandith.ajith@gmail.com"]`, `subject` and a
  plain-text `body`. Do not use Markdown in the body.
- **Subject:** copy the subject line exactly, emoji included, replacing only the placeholders.
- **Fallback:** if the email tool is unavailable or the send fails, print the message (subject
  and body) to the run log and exit non-zero, so the run shows as failed. (D2 in
  `docs/decisions.md`, email from a routine, is not yet confirmed.)

## Placeholders

| Placeholder | Example | Where it comes from |
|---|---|---|
| `<Month YYYY>` | `October 2026` | The target month in words (English month name, 4-digit year), from the IST date in ROUTINE step 0, so it is known even when setup fails |
| `<month>` | `2026-10` | The target month id (ROUTINE step 0, confirmed by `should-run`) |
| `<episode>` | `139` | `sources/<month>/meta.json` → `episode` (write `unknown` if not available) |
| `<date>` | `25 October 2026` | `sources/<month>/meta.json` → `date`, written out (write `unknown` if not available) |
| `<langs>` | `en, hi, kn, ta` | `completeLangs` from `reports/<month>.content.json` |
| `<warnings>` | `1` | `warnings` from the report |
| `<run-time>` | `2026-10-26 11:30 IST` | When this run started |

## 1. Success: published and live

**Subject:**

    ✅ Mann Ki Baat <Month YYYY> is live

**Body:**

    Mann Ki Baat episode <episode> (<date>) is now live.

    English: https://yawdor.github.io/mann-ki-baat/<month>/
    Hindi:   https://yawdor.github.io/mann-ki-baat/hi/<month>/
    <one line per other complete language: "<Language>: https://yawdor.github.io/mann-ki-baat/<lang>/<month>/">

    Languages published: <langs>
    Machine languages left out: <list, or "none">
    Warnings: <warnings>
    <one line per warning message from the report, or nothing if there are none>
    <"Suspected injected instructions: <where, and a short description>" for any found, or nothing>

    Schemes: <n> full, <m> mention-only (new records: <ids, or "none">)

    Official sources:
    <sources.en>
    <sources.hi>

    Commit: https://github.com/yawdor/mann-ki-baat/commit/<commit sha>
    To roll back: git revert <commit sha>, then push to main.

    Run: <run-time>. Sent automatically by the Mann Ki Baat monthly routine.

## 2. Failure: not published

Use this for every failure path in `ROUTINE.md`: validation failed (draft pushed), or an error
stopped the run before or after validation, or the site did not go live after the push. Send it
only after the duplicate check in `ROUTINE.md` (the failures changed since the last draft, or it
is day 4 IST). Setup, `discover` and `save-sources` failures are emailed on day 4 only.

**Subject:**

    ⚠️ Mann Ki Baat <Month YYYY> not published

**Body:**

    Mann Ki Baat <Month YYYY> (episode <episode>) was not published. The live site is unchanged.

    Stage that failed: <setup | discover | save-sources | validate | publish | deploy>

    Failed checks:
    - <check name>: <message>
    - <check name>: <message>
    <one line per message of every result with ok: false and level "error" in
     reports/<month>.content.json; for an error outside validation, the CLI's {"error": "..."} text>

    Warnings:
    - <check name>: <message>
    - <"Suspected injected instructions: <where, and a short description>", if any>
    <or "none">

    Drafts branch: https://github.com/yawdor/mann-ki-baat/tree/drafts/<month>
    <or, if nothing was drafted: "Drafts branch: none (nothing was drafted at this stage)">
    Report: reports/<month>.content.json on the drafts branch
    <for a deploy failure instead: "Deploy runs: https://github.com/yawdor/mann-ki-baat/actions">

    What happens next: <"The routine will try again tomorrow at 11:30 IST." if today is before
    day 4 of the next month (IST), otherwise "This was the last run in the window; fix the month
    by hand (see README, 'Fix a month')."">

    Run: <run-time>. Sent automatically by the Mann Ki Baat monthly routine.

## 3. Missing: no transcript after day 4

Sent only on day 4 (IST) of the following month, when `discover` still finds no episode dated in
`<month>`.

**Subject:**

    ℹ️ No Mann Ki Baat transcript found for <Month YYYY>

**Body:**

    No official Mann Ki Baat transcript dated in <Month YYYY> was found on pmindia.gov.in.
    The broadcast may have been paused or the transcript not yet published. The site is unchanged.

    Checked: https://www.pmindia.gov.in/en/tag/mann-ki-baat/
    Discover said: <reason from the discover output>

    This was the last run in the window for <Month YYYY>. If a transcript appears later, run the
    month by hand (see README, "Run a month by hand").

    Run: <run-time>. Sent automatically by the Mann Ki Baat monthly routine.
