# Decisions (Task 0 and later)

Full research notes: `docs/task0-research.md`.

## D1: Routine can push to GitHub. Status: BLOCKED (26 Oct 2026)
Creating a routine returned `github_token_missing`, because the owner's claude.ai account is not connected to GitHub yet. Retest once it is connected. Fallback: GitHub Actions cron (`monthly.yml`) with an `ANTHROPIC_API_KEY` secret.

## D2: Routine can send email via Gmail. Status: BLOCKED (same probe as D1)
The Gmail connector is attached to the account (uuid `e0cc90b0-c3ac-4721-ac5a-f5c47e4b7d54`). Fallback: the workflow opens a GitHub issue, and GitHub emails failures.

## D3: Transcript sources. Status: DONE
- **Source:** pmindia.gov.in only. PIB has no stable transcript URL.
- **English URL:** `https://www.pmindia.gov.in/en/news_updates/pms-address-in-the-{N}{st|nd|rd|th}-episode-of-mann-ki-baat/`
- **Hindi URL:** `https://www.pmindia.gov.in/hi/news_updates/मन-की-बात-की-{N}वीं-कड़ी-में-प्र/` (percent-encoded). Derive it by pattern, and confirm it via `https://www.pmindia.gov.in/hi/tag/mann-ki-baat/` (follow redirects).
- **Discovery:** use `https://www.pmindia.gov.in/en/tag/mann-ki-baat/`; the newest item is first and its number comes from the title. The listing lags, so also probe episode N+1 directly.
- **Paragraphs:** `div.news-bg > p`, excluding anything inside `div.tweet-container` and the iframe paragraph. Drop paragraphs that are empty or whose text is only `>>>`. The markup is malformed, so use a real parser (node-html-parser).
- **Date:** `div.share_date span.date` (e.g. "25 Oct, 2026"). Ignore the template's "Date : 25-01-2017".
- **Episode number:** the `<h2>` in `div.content-block`. Episode 139 is 25 Oct 2026.
- **Original vs translation:** the Hindi text is the original speech; the English is the PMO's translation.
- **Fetching:** no bot blocking was seen with a `Mozilla/5.0` UA. Pages are server-rendered.
- **Fixtures:** `tests/fixtures/transcripts/{en,hi}-{138,139}.html`.

## D4: Other languages. Status: DONE (owner approved 26 Oct 2026)
Google's website translator was retired on 1 Oct 2026, and Bhashini needs a registered key with proof-of-concept terms. Decision: English and Hindi are built from the official text. Kannada, Tamil, Telugu, Bengali and Marathi are pre-translated by the routine (non-blocking). For everything else there is a guide to the browser's built-in "Translate this page". No third-party translate script.

## D5: Map data. Status: DONE (verify on download)
- **Primary:** the Survey of India states file from `ramSeraph/indian_admin_boundaries`, release `states`, `SOI_States` (CC0; credit "Survey of India boundaries via DataMeet / ramSeraph").
- **Secondary:** `udit-001/india-maps-data` `geojson/india.geojson`, dissolved by `st_nm` (no licence stated, so use it only if the primary fails).
- **Processing:** simplify with mapshaper to ≤ 400 KB.
- **Verify:** Ladakh's bbox reaches lat ≈ 37.1 and lon 72.5–80.3, and J&K includes PoK.
- **Outcome (Task 8):** primary used. `SOI_States.geojsonl.7z` extracted with `7zip-bin` and simplified with mapshaper 0.6.112 (0.8%, keep-shapes) to `src/data/india-states.geojson` (358 KB, 36 features, 4 inter-state DISPUTED slivers dropped). Verified Ladakh bbox lon 72.51-80.35, lat 32.34-37.09 and J&K includes PoK. The secondary was not needed. Steps are in `scripts/build-map-data.md`. `bhuvan_states` was rejected (old names such as Orissa, DNH and Daman & Diu split).
- **Avoid:** Natural Earth, GADM, geoBoundaries, OSM-derived files.
- **Map note:** "Map for illustration; boundaries as per Survey of India."

## Rulings during execution
- Ruling: Node 24 (installed locally) is used locally and in CI instead of the plan's Node 20 — Node 24 is the current LTS and is already installed — if wrong, change one line in the CI config.
- Ruling: the public GitHub repo is created by the owner, not by Claude, because the permission system blocks Claude from creating public repos. All work happens in a local repo until Task 10's deploy step — if wrong, there's no cost; it's one command for the owner.
- Ruling: `design/tokens.json` was hand-written from the approved canvas (StyleTile) values, because the Artifact tool and Design System export were not available to the implementer — if wrong, regenerate it from a Claude Design System export; `npm run tokens` rebuilds the CSS.
- Ruling: Mehendi darkened `#12915A` → `#118754` because white on `#12915A` has contrast 4.02, below the 4.5 AA minimum for normal text (new value 4.55) — if wrong, restore the old hex and use mehendi only as a decorative or large-text colour. Palette lines in the plan and global constraints were updated; the canvas boards (`design/canvas/*.dc.html`) still show the old hex.
- Ruling: Marigold is `usage: "decorative"` and Haldi `usage: "surface"` (dark text on haldi passes at 9.7, but haldi on white fails) — if wrong, nothing breaks; it only constrains how they may be used.
