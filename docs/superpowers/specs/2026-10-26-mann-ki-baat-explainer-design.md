# Mann Ki Baat Explained — Design Spec

**Date:** 26 Oct 2026
**Owner:** Ajith Pandith (GitHub: `yawdor`)
**Status:** Awaiting owner review
**Visual design:** Claude Design canvas "Mann Ki Baat Explainer" — https://claude.ai/artifact/FKo9R767fsiNH9Z61EhfEF (approved "Utsav" look)

---

## 1. Purpose

A free, public, monthly website that explains each episode of the Prime Minister's *Mann Ki Baat* radio address. It is written mainly for citizens of India and is readable worldwide.

The site has two jobs, in priority order:

1. **Help people benefit from schemes.** For every government scheme or initiative mentioned, it says what the scheme gives, who qualifies, how to apply, which documents to keep ready, and the official link and helpline.
2. **Give a clear view of every topic discussed.** This covers stories, people praised, culture, appeals and the places mentioned, presented in a visually rich, easy-to-follow layout.

### Success criteria

- Each episode is live within 4 days of broadcast, with no manual work.
- Every scheme fact traces to an official government source. Every quote matches the official transcript word for word.
- Pages work on low-end phones, in English and Hindi, and pass automated accessibility checks.
- Hosting costs £0. The monthly run uses the owner's existing Claude subscription, with no API bill.

### Non-goals (for now)

- Audio or video hosting. The site links to official sources instead.
- Comments, accounts, newsletters or analytics beyond what GitHub Pages provides.
- Human-reviewed translations into languages other than Hindi.
- Any official affiliation. The site is an **independent, unofficial explainer**.

---

## 2. Decisions taken during brainstorming

| Topic | Decision |
|---|---|
| Audience | Public, India-first, readable worldwide |
| Languages | English by default; Hindi as a full second language; every other language via a machine-translate menu with a visible notice |
| Hosting | GitHub Pages, public repo `github.com/yawdor/mann-ki-baat`, served at `https://yawdor.github.io/mann-ki-baat/` |
| Monthly effort | **Fully automatic**, with no human approval step. Safety comes from automated validators and a fail-safe that publishes nothing if any check fails. |
| Build approach | **A**: a Claude Code scheduled routine generates the content, and an Astro static site is built and deployed by GitHub Actions |
| Design | **Editorial base + Indian cultural vibrant**, refined into the "Utsav" look (see section 6), designed in Claude Design |
| Interactivity | All of: scroll motion, count-up numbers, filterable topics, expandable scheme cards, scheme search, per-month accent and motif |
| Page content | At a glance, topic explainers, scheme "How to benefit" cards, people & stories, places map, home page with archive, trends and scheme index |

---

## 3. Architecture

```
mann-ki-baat/
├─ sources/YYYY-MM/                ← raw official transcripts (en.html, hi.html, meta.json), kept unaltered as evidence
├─ content/episodes/YYYY-MM.json   ← one data file per episode (source of truth for its page)
├─ content/schemes/<id>.json       ← reusable scheme records, updated over time
├─ src/                            ← Astro site: layouts, components, pages
├─ design/tokens.json              ← colours, type, spacing, radii from the Claude Design System
├─ pipeline/                       ← fetch → extract → enrich → translate steps (routine instructions + helper scripts)
├─ validators/                     ← automated checks; all must pass before publishing
├─ tests/                          ← validator fixtures, site render tests
└─ .github/workflows/deploy.yml    ← build + validate + deploy to Pages on push to main
```

**Key principle:** the site code never changes month to month. A new episode is **one new data file** (plus any new scheme records). New months create new pages automatically. The home page, archive, trends and scheme index rebuild from all the files on every build.

### Units

| Unit | Responsibility | Input → Output | Depends on |
|---|---|---|---|
| **Fetcher** | Finds that month's episode and saves the official transcripts unaltered | Month → `sources/YYYY-MM/{en,hi}.html`, `meta.json` (URLs, fetch time, hashes) | PIB / pmindia.gov.in |
| **Extractor** | Turns the transcripts into a structured episode file | Sources → `content/episodes/YYYY-MM.json` (English fields) | Fetcher output, schema |
| **Scheme enricher** | Fills in scheme details from official portals, or reuses existing records | Scheme mentions → `content/schemes/<id>.json` | myScheme.gov.in, ministry portals |
| **Translator** | Adds Hindi to every text field; quotes come from the official Hindi transcript | English fields → `hi` fields | Hindi transcript |
| **Validators** | Decide whether the content can be published | Episode + schemes + built site → pass/fail report | Schema, sources |
| **Site** (Astro) | Renders every page from the data and design tokens | Content + tokens → static HTML/CSS/JS | — |
| **Deploy** (GitHub Actions) | Builds, runs the site-level validators, and publishes to Pages | Push to `main` → live site | Site, validators |
| **Notifier** | Emails the owner the run result | Result → email to pandith.ajith@gmail.com | Gmail connector (see §9 open checks) |

---

## 4. Data model

All text fields are bilingual objects: `{ "en": "...", "hi": "..." }`. All facts carry a `source`: either `{ "transcript": "en|hi", "para": N }` or `{ "url": "https://…gov.in/…" }`.

### Episode (`content/episodes/YYYY-MM.json`)

| Field | Notes |
|---|---|
| `episode` | Episode number (from the official source) |
| `date` | Broadcast date (ISO) |
| `title`, `summary` | Headline theme; 30-second summary (3–4 sentences) |
| `theme` | `{ accent: one of the palette accents, motif: lotus\|diya\|peacock\|wheat\|… }`, chosen from the main topic |
| `sources` | Official transcript URLs (en, hi) |
| `topics[]` | `id`, `title`, `category` (Schemes / Environment / Culture / People / Youth / Health / Science / Other), `explainer` (2–3 plain-language lines), `facts[]` (each with `source`), `quote` (verbatim + paragraph), `schemeIds[]`, `placeIds[]`, `personIds[]` |
| `people[]` | `name`, `place`, `story`, `topicId`, `source` |
| `places[]` | `name`, `state`, `lat`, `lng`, `topicId` |
| `stats[]` | `value`, `label`, `context`, `source`; only numbers actually spoken in the episode |
| `counts` | Derived at build time (topics, schemes, people, states); never hand-entered |

### Scheme (`content/schemes/<id>.json`)

| Field | Notes |
|---|---|
| `id`, `name` | Official name in English and Hindi |
| `gives` | One-line benefit |
| `eligibility[]`, `steps[]`, `documents[]` | Taken from the official portal only |
| `officialUrl`, `helpline` | Must be on `.gov.in` / `.nic.in`; helpline only if listed officially |
| `audiences[]` | farmers, women, students, senior-citizens, households, youth, health, business, … |
| `states[]` | `all`, or a list of states |
| `checkedAt` | Date the details were last verified against the portal |
| `mentions[]` | Episodes that mentioned it (appended each month) |
| `detailLevel` | `full` (portal verified) or `mention-only` (no official detail found: show the name, one line and the official link only) |

**The no-guessing rule:** eligibility, steps, documents and helpline may only come from an official page. If the enricher cannot find one, the scheme is saved as `mention-only`. It never fills in rules from general knowledge.

---

## 5. Pages

| Page | URL | Contents |
|---|---|---|
| Home | `/` (and `/hi/`) | Latest-episode banner; archive grid (one arch card per month, in that month's accent); trends; link to the scheme index |
| Episode | `/YYYY-MM/` (and `/hi/YYYY-MM/`) | Hero (toran, mandala, episode number and date, headline, summary, CTAs) → At a glance (summary + arch stat tiles) → Topics (filter chips + colour-coded cards with key facts) → Quote → Schemes "How to benefit" (search, audience chips, expandable cards) → People & stories → Places map + list → Footer disclaimer and official sources |
| Trends | section of Home | Theme × month "flower" grid, built from all episode files |
| Scheme index | `/schemes/` | Every scheme ever mentioned, with audiences, episodes and official link; searchable |

**Map:** India state boundaries from an official or open dataset (Survey of India–compliant boundaries) rendered as inline SVG at build time, with a pin for each place. The list beside it doubles as the accessible alternative.

**Language switching** (revised 26 Oct 2026 after research: Google's website translator was retired on 1 Oct 2026, and Bhashini needs a registered API key):
- **English and Hindi:** the switch moves between `/…` and `/hi/…`, keeping the reader's position on the page.
- **Pre-translated languages:** Kannada (`/kn/`), Tamil (`/ta/`), Telugu (`/te/`), Bengali (`/bn/`) and Marathi (`/mr/`) are machine-translated by the monthly routine from the English and Hindi content. They carry the banner *"Machine-translated — check official links for exact eligibility."* Quotes in these languages are shown in Hindi with the language's translation beneath, marked as a translation.
- **All other languages:** the "More languages" button opens a short guide to the reader's browser's built-in "Translate this page" (Chrome/Android, Edge, Safari), showing the same notice.
- Machine-translated languages are not blocking. If their translation fails validation, the episode still publishes in English and Hindi, and the email notes which languages are missing.

---

## 6. Visual design ("Utsav")

Source of truth: the Claude Design canvas above. Its style tile becomes a Claude **Design System**, and its tokens are exported to `design/tokens.json`.

- **Palette:**

  | Name | Hex | Role |
  |---|---|---|
  | Kumkum | `#7A1431` | Primary |
  | Haldi | `#F2B705` | Primary accent / CTA |
  | Marigold | `#F07F13` | Accent |
  | Peacock | `#0B4F6C` | Accent |
  | Mehendi | `#12915A` | Accent |
  | Gulabi | `#B0124A` | Accent |
  | Chandan | `#FFF3D1` | Section background |
  | Text | `#2A1205` | Body text; on white |

  All text pairs must meet WCAG AA contrast.
- **Type:** Rozha One for headlines (Latin + Devanagari); Mukta for body text (Latin + Devanagari), 17–18px with generous line height.
- **Ornaments (inline SVG, decorative, `aria-hidden`):**
  - **Toran:** marigold-and-mango-leaf garland.
  - **Mandala:** layered, in the hero.
  - **Ajrakh:** block-print overlay on dark sections.
  - **Block-print bands:** between sections.
  - **Kolam dots:** behind the topics and the map.
  - **Paisley corners:** on the quote block.
  - **Jharokha arches:** stat tiles, people cards and archive cards.
- **Per month:** accent colour and the hero's centre motif (lotus, diya, peacock, wheat sheaf, …) come from `theme` in the episode file.
- **Motion:**
  - **Hero:** the mandala rotates slowly and the toran sways gently.
  - **Content:** sections "bloom" in on scroll, and numbers count up once.
  - **Reduced motion:** all of it is disabled under `prefers-reduced-motion`.
- **Imagery rules:** no national emblem, no PMO or Government of India logos, and no photographs of the PM. Custom illustration and typography only. The footer always shows the "independent, unofficial explainer" disclaimer and official source links.

---

## 7. Monthly pipeline

**Trigger:** a Claude Code scheduled routine runs daily at 11:30 IST from the 26th of each month to the 4th of the next. It does nothing if that month's episode file already exists on `main`.

**Run steps:**
1. **Fetch:** find the episode's official English and Hindi transcripts and save them to `sources/YYYY-MM/`.
2. **Extract:** produce the English episode file following the schema.
3. **Enrich schemes:** reuse existing records, or create new ones from official portals (`full` or `mention-only`). Append to `mentions[]`.
4. **Translate:** fill the `hi` fields. Quotes come from the official Hindi transcript, matched to the English paragraph.
5. **Validate content** (§8). On pass, commit to `main`. On fail, commit to a `drafts/YYYY-MM` branch.
6. **Deploy:** the push to `main` triggers GitHub Actions to build, run the site validators and deploy to Pages.
7. **Notify:** email the owner with the result and link.

### Failure handling

| Situation | Behaviour |
|---|---|
| Transcript not yet published | Exit quietly; retry next day. If still missing after the 4th, email "No transcript found for <month>". |
| Content validator fails | Nothing is published. Draft is pushed to `drafts/YYYY-MM`, and an email lists each failed check. |
| Build, site validator or deploy fails | The previous site stays live; an email includes the error log link. |
| Error found after publishing | `git revert` the episode commit, or the owner asks Claude Code to fix that month. |
| No episode that month (e.g. broadcast paused) | After the 4th, email "No episode found for <month>"; the site is unchanged. |

---

## 8. Validators and testing

### Content validators (run by the routine before committing to `main`)

| Check | Rule |
|---|---|
| Schema | Episode and scheme files match the JSON schema; no missing required fields |
| Verbatim quotes | Each quote string appears exactly in the saved transcript paragraph it cites (both languages) |
| Sources | Every fact has a source; every URL source is on `.gov.in` / `.nic.in` (or the PIB / pmindia domains) |
| Link health | Every official link returns HTTP 200 (after redirects) |
| Bilingual | Every `en` field has a non-empty `hi` field, and `hi` text is mostly Devanagari |
| No-guessing | A `full` scheme must have `checkedAt` and an official `source` for eligibility, steps and documents |
| Sanity | 3 ≤ topics ≤ 25; episode number is greater than the previous one; broadcast date falls in that month. (Not being the last Sunday is only a warning in the email, because broadcasts occasionally move.) |

### Site validators (run in GitHub Actions before deploy)

- Astro build succeeds.
- Playwright renders the home, episode and Hindi episode pages at desktop (1440px) and phone (390px) widths, with no console errors.
- axe accessibility check: no serious or critical issues.
- Performance budget: episode page ≤ 300 KB transferred (excluding fonts) and Lighthouse performance ≥ 90 on mobile.

### Tests built during implementation

- **Validator unit tests:** each validator gets good and deliberately broken fixture files, proving it catches each failure.
- **Site render tests:** these use fixture data and, later, the real October 2026 episode.

### Launch

The first real episode (October 2026) is run live in a Claude Code session with the owner watching end to end. After that, the routine runs fully automatically.

---

## 9. Open checks for the planning stage

These must be confirmed, not assumed, before building the parts that depend on them:

1. **Routines and GitHub.** Can a Claude Code scheduled routine on the owner's plan clone, commit and push to `yawdor/mann-ki-baat`? *Fallback:* a GitHub Actions cron running the same pipeline with an Anthropic API key (about $1–3 a month).
2. **Routines and email.** Can the routine send email through the Gmail connector? *Fallback:* GitHub Actions failure notifications plus a GitHub issue opened on failure.
3. **Transcript sources.** The exact, stable URLs and HTML structure for the English and Hindi transcripts on PIB and pmindia.gov.in.
4. **Machine translation.** *Resolved:* pre-translated kn/ta/te/bn/mr, plus a browser-translate guide (see §5).
5. **Map data.** A licence-compatible India boundary dataset that shows official boundaries.

---

## 10. Legal and editorial guardrails

- The site is clearly labelled an independent, unofficial explainer, with no use of government emblems, logos or photos of the PM.
- Transcript text is reproduced only as short verbatim quotes, with attribution and links to the official source.
- No quote, statistic, person or place is published unless it appears in the official transcript.
- Scheme guidance always defers to the official portal ("Always apply through the official link").
- Machine-translated pages carry a visible notice.
