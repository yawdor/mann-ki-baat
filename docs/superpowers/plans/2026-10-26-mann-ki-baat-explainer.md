# Mann Ki Baat Explained — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free GitHub Pages site that publishes a validated, bilingual (English/Hindi), visually rich explainer of every monthly Mann Ki Baat episode, generated fully automatically by a Claude Code routine.

**Architecture:**
- **Content:** each episode is one JSON file, validated by Zod schemas and a set of content validators.
- **Site:** an Astro static site renders every page from those files and from design tokens exported from the Claude Design System.
- **Monthly run:** a scheduled Claude Code routine fetches the official transcripts, writes the JSON, runs the validators, and commits either to `main` or to a `drafts/` branch.
- **Deploy:** GitHub Actions builds the site, runs the site validators, and deploys to Pages.

**Tech Stack:** Node 20 LTS, TypeScript, Astro 5 (static output), Zod, Vitest, Playwright + @axe-core/playwright, @lhci/cli, d3-geo (build-time map), node-html-parser, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-26-mann-ki-baat-explainer-design.md`
**Visual source of truth:** https://claude.ai/artifact/FKo9R767fsiNH9Z61EhfEF (the Main, Mobile, StyleTile and Archive boards)

## Global Constraints

- Repo: `github.com/yawdor/mann-ki-baat`, public. Astro `site: 'https://yawdor.github.io'`, `base: '/mann-ki-baat'`.
- Languages: `LANGS = ['en','hi','kn','ta','te','bn','mr']`. `en` and `hi` are required and blocking. `kn ta te bn mr` are machine-translated, optional and non-blocking (spec §5, revised 26 Oct 2026).
- URLs: `/` (en) and `/<lang>/` for the other languages (home); `/YYYY-MM/` and `/<lang>/YYYY-MM/` (episode); `/schemes/` and `/<lang>/schemes/`. Episode pages for a machine language are generated only if that episode has the language complete.
- Month id format: `^\d{4}-(0[1-9]|1[0-2])$`.
- Every text field is `Localized = { en: string; hi: string; kn?: string; ta?: string; te?: string; bn?: string; mr?: string }`. Every fact carries `source`: `{ transcript: 'en'|'hi', para: number }` or `{ url: string }`.
- Fonts for other scripts (loaded only on that language's pages): display Baloo Tamma 2 (kn), Baloo Thambi 2 (ta), Baloo Tammudu 2 (te), Baloo Da 2 (bn); body Noto Sans Kannada, Tamil, Telugu and Bengali. Marathi uses Rozha One and Mukta (Devanagari).
- Allowed official domains: hosts ending in `.gov.in` or `.nic.in`, plus `pib.gov.in` and `pmindia.gov.in`.
- **No-guessing rule:** a scheme with `detailLevel: 'full'` must have `checkedAt` and an official `source` for its eligibility, steps and documents. Otherwise it must be `'mention-only'`.
- Palette (exact): Kumkum `#7A1431`, Haldi `#F2B705`, Marigold `#F07F13`, Peacock `#0B4F6C`, Mehendi `#118754`, Gulabi `#B0124A`, Chandan `#FFF3D1`, Text `#2A1205`, White `#FFFFFF`.
- Fonts: Rozha One (headlines), Mukta 400/500/600/700 (body), from Google Fonts. Body text is 17–18px.
- Ornaments are inline SVG with `aria-hidden="true"`. No national emblem, no PMO or GoI logos, and no photos of the PM.
- Footer disclaimer (exact English): "An independent, unofficial explainer. Not affiliated with the Prime Minister's Office or the Government of India. Quotes are taken word for word from the official transcript; scheme details are checked against official portals. Translations beyond English and Hindi are machine-generated — rely on the official links for exact eligibility."
- Machine-translate notice (exact): "Machine-translated — check official links for exact eligibility."
- All motion is disabled under `prefers-reduced-motion: reduce`.
- Routine window: daily at 11:30 IST (06:00 UTC), from day 26 of month M to day 4 of month M+1, targeting month M.
- Owner email for notifications: pandith.ajith@gmail.com.
- Site budgets: episode page ≤ 300 KB transferred excluding fonts; Lighthouse mobile performance ≥ 90; axe has no serious or critical violations.
- Content sanity: 3 ≤ topics ≤ 25; the episode number must be greater than the previous episode's; the date must fall in the month. Not being the last Sunday is a **warning** only.

## Review Focus

1. **Text normalisation in quote matching.** A transcript may contain curly or straight quotes, non-breaking spaces, en- or em-dashes, or Devanagari nukta forms that are composed in one place and decomposed in another. A quote that is truly verbatim must still match. → This is `normalizeText` in Task 3, with dedicated test cases.
2. **Year boundary.** Runs on 1–4 January must target December of the *previous* year. → A test of `targetMonth` in Task 11.
3. **Government sites that are slow or block bots.** Pages may return a timeout, 403 or 429 on the first try. Retry three times with a 20-second timeout and a browser User-Agent. Fail only after all retries. Treat any 2xx after redirects as OK. → A link-health test in Task 3.
4. **Categories with no topics.** Filter chips must only show categories that have at least one topic. A section with no data (no people, no places, no stats) must be left out, not rendered empty. → Tests in Task 7.
5. **Long Hindi strings at 390px.** These must wrap, with no horizontal page scroll. → A Playwright overflow assertion in Task 10.

---

## File Structure

```
mann-ki-baat/
├─ astro.config.mjs                      site/base/static output
├─ package.json, tsconfig.json, vitest.config.ts, playwright.config.ts, lighthouserc.json
├─ design/tokens.json                    exported from Claude Design System (Task 4)
├─ content/episodes/YYYY-MM.json
├─ content/schemes/<id>.json
├─ sources/YYYY-MM/{en.html,hi.html,en.paras.json,hi.paras.json,meta.json}
├─ src/lib/schema.ts                     Zod schemas + types
├─ src/lib/text.ts                       normalizeText, isMostlyDevanagari
├─ src/lib/content.ts                    loaders, derived counts, trends
├─ src/lib/i18n.ts                       UI strings en/hi, localePath()
├─ src/styles/tokens.css                 generated from design/tokens.json
├─ src/styles/global.css                 base, motion, reduced-motion
├─ src/components/ornaments/*.astro      Toran, Mandala, BlockBand, Kolam, Paisley, Ajrakh
├─ src/components/episode/*.astro        Hero, Glance, Topics, Quote, Schemes, People, PlacesMap, Footer, Header
├─ src/components/home/*.astro           LatestBanner, ArchiveGrid, Trends
├─ src/scripts/*.ts                      filter.ts, schemes.ts, motion.ts, translate.ts (client islands)
├─ src/data/india-states.geojson         boundary data (Task 0 decides source)
├─ src/pages/index.astro, [month].astro, schemes.astro, hi/index.astro, hi/[month].astro, hi/schemes.astro
├─ validators/types.ts, checks/*.ts, run.ts
├─ pipeline/window.ts, fetch.ts, paras.ts, publish.ts, ROUTINE.md, notify.md
├─ tests/fixtures/…, tests/unit/*.test.ts, tests/e2e/*.spec.ts
└─ .github/workflows/deploy.yml
```

---

> **Status 26 Oct 2026:** D3, D4 and D5 are answered in `docs/decisions.md`. D1 and D2 are blocked until the owner connects GitHub to claude.ai. They only gate Task 12, so Tasks 1–11 proceed.

### Task 0: Confirm the open checks (spike, no product code)

**Files:**
- Create: `docs/decisions.md` (in the new repo once it exists; until then, in the Productivity `docs/` folder)

**Interfaces:**
- Produces: decisions D1–D5 that Tasks 8, 9, 11 and 12 read.

- [ ] **Step 1 (D1 — routine and git):** Use the `schedule` skill to create a throwaway routine. It clones a scratch repo `yawdor/routine-probe`, commits one file and pushes. Record pass or fail. If it fails, record the fallback: a GitHub Actions cron with an `ANTHROPIC_API_KEY` secret.
- [ ] **Step 2 (D2 — routine and email):** In the same probe, send a test email to pandith.ajith@gmail.com through the Gmail connector. Record pass or fail. If it fails, record the fallback: a GitHub issue opened by the workflow, plus GitHub's own failure emails.
- [ ] **Step 3 (D3 — transcript sources):** Find the 25 Oct 2026 episode's English and Hindi transcript pages on pmindia.gov.in and pib.gov.in. Record the URL pattern, the CSS selector for the paragraphs, and how a listing page reveals a new episode.
- [ ] **Step 4 (D4 — machine translation):** Compare the Google website translator element with Bhashini for a static page that has no server. Record the chosen provider, its script URL or API, and its terms.
- [ ] **Step 5 (D5 — map data):** Choose an India state-boundary GeoJSON that shows official boundaries and has a licence that allows reuse. Record the URL and the licence.
- [ ] **Step 6:** Delete the probe routine and the probe repo. Show `docs/decisions.md` to the owner. **Stop if D1 failed:** the owner chooses the fallback before Task 11.

### Task 1: Repository and Astro scaffold

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/pages/index.astro` (placeholder), `tests/unit/smoke.test.ts`, `.gitignore`, `README.md`

- [ ] **Step 1:** Confirm with the owner before creating the public repo. Then run `gh repo create yawdor/mann-ki-baat --public --clone`, and move the spec, this plan and `docs/decisions.md` into the repo's `docs/`.
- [ ] **Step 2:** `npm create astro@latest -- --template minimal --typescript strict`. Pin exact versions in `package.json`. Add `zod vitest node-html-parser d3-geo @playwright/test @axe-core/playwright @lhci/cli` as dev dependencies, with exact versions.
- [ ] **Step 3:** In `astro.config.mjs`, set `site: 'https://yawdor.github.io'`, `base: '/mann-ki-baat'`, `output: 'static'`, and `trailingSlash: 'always'`.
- [ ] **Step 4:** Write `tests/unit/smoke.test.ts` asserting `1 + 1 === 2`. Run `npx vitest run`. Expected: 1 passed.
- [ ] **Step 5:** `npx astro build`. Expected: `dist/index.html` exists.
- [ ] **Step 6:** Commit with the message "chore: scaffold Astro site".

### Task 2: Content schemas

**Files:**
- Create: `src/lib/schema.ts`, `tests/fixtures/episodes/2026-09.json` (valid), `tests/fixtures/schemes/pm-kisan.json` (valid, `full`), `tests/fixtures/schemes/sample-mention.json` (`mention-only`), `tests/unit/schema.test.ts`

**Interfaces:**
- Produces:
  - **Types:** `Lang`, `Localized`, `Source`, `Fact`, `Topic`, `Person`, `Place`, `Stat`, `Episode`, `Scheme`.
  - **Schemas:** `EpisodeSchema`, `SchemeSchema` (Zod), `LANGS`, `MACHINE_LANGS = ['kn','ta','te','bn','mr']`, `MONTH_RE`, `CATEGORIES`, `ACCENTS`, `MOTIFS`, `AUDIENCES`.
  - **Field names:** as in spec §4. Ids are kebab-case strings. `Topic.category` is one of `CATEGORIES = ['Schemes','Environment','Culture','People','Youth','Health','Science','Other']`. `ACCENTS` are the six non-neutral palette hexes. `MOTIFS = ['lotus','diya','peacock','wheat','wheel','mandala']`.

- [ ] **Step 1:** Write tests:
  - `parses valid episode fixture`
  - `rejects month "2026-13"`
  - `rejects Localized missing hi`
  - `accepts Localized with optional kn and without ta`
  - `rejects fact without source`
  - `rejects full scheme without checkedAt`
  - `accepts mention-only scheme without eligibility`
- [ ] **Step 2:** `npx vitest run tests/unit/schema.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/lib/schema.ts`. Use `.superRefine` on `SchemeSchema` for the no-guessing rule: `full` requires non-empty `eligibility`, `steps` and `documents`, plus `checkedAt` (ISO date) and `detailSource: { url }` on an allowed domain.
- [ ] **Step 4:** Run the tests. Expected: 7 passed.
- [ ] **Step 5:** Commit with the message "feat: content schemas".

### Task 3: Content validators

**Files:**
- Create: `src/lib/text.ts`, `validators/types.ts`, `validators/checks/{schema,quotes,sources,links,languages,noGuessing,sanity}.ts`, `validators/run.ts`
- Create: `tests/unit/text.test.ts`, `tests/unit/validators.test.ts`, and broken fixtures in `tests/fixtures/broken/*.json`, one per failure

**Interfaces:**
- Consumes: `EpisodeSchema`, `SchemeSchema` (Task 2).
- Produces:
  - `normalizeText(s: string): string`: NFC normalisation; collapses whitespace including U+00A0; turns curly quotes into straight ones; turns en- and em-dashes into "-"; trims.
  - `isMostlyScript(s: string, lang: Lang): boolean`: at least 60% of letters are in the language's block. hi and mr use U+0900–U+097F, kn U+0C80–U+0CFF, ta U+0B80–U+0BFF, te U+0C00–U+0C7F, bn U+0980–U+09FF; en is always true.
  - **`languages` check:**
    - **en/hi:** a missing or empty `en`/`hi`, or `hi` failing `isMostlyScript`, is an **error**.
    - **Machine languages:** a machine language present on some fields but not all of them, or failing `isMostlyScript`, is a **warning**, and that language is excluded.
    - **Report:** the report gains `completeLangs: Lang[]`, which always contains `en` and `hi` when ok.
  - `type CheckResult = { check: string; level: 'error' | 'warning'; ok: boolean; messages: string[] }`
  - `type ValidationContext = { month: string; episode: Episode; schemes: Map<string, Scheme>; paras: { en: string[]; hi: string[] }; previous?: Episode; fetch: typeof fetch }`
  - Each check is `(ctx) => CheckResult | Promise<CheckResult>`.
  - `runContentValidation(month: string, opts: { root: string; fetch?: typeof fetch }): Promise<{ month: string; ok: boolean; results: CheckResult[] }>`. `ok` means no failing `error`-level results.
  - CLI: `npm run validate:content -- 2026-10` writes `reports/2026-10.content.json` and exits 1 if not `ok`.

- [ ] **Step 1:** Write `text.test.ts`:
  - `normalizeText("“Hello” – world  ") === '"Hello" - world'`
  - Devanagari: `normalizeText('क़') === normalizeText('क़')`
  - `isMostlyScript('मन की बात','hi') === true`
  - `isMostlyScript('Mann Ki Baat','hi') === false`
  - `isMostlyScript('ಮನ್ ಕಿ ಬಾತ್','kn') === true`
  - `isMostlyScript('மன் கி பாத்','te') === false`
- [ ] **Step 2:** Write `validators.test.ts`. There is one test per check, using the broken fixtures, each asserting `ok === false` with a message naming the field. Plus:
  - `quotes passes when transcript has curly quotes and quote has straight`
  - `links retries 3 times then fails` (mock fetch: 429, 429, 429)
  - `links passes on 403 then 200`
  - `links accepts 301→200`
  - `sanity warns (not errors) when date is not last Sunday`
  - `sources rejects https://example.com`
  - `sources accepts https://pmkisan.gov.in/x`
  - `runContentValidation ok on valid fixture`
  - `languages: partial kn gives a warning, ok stays true, and completeLangs excludes kn`
  - `languages: empty hi on one topic gives an error`
- [ ] **Step 3:** Run them. Expected: FAIL.
- [ ] **Step 4:** Implement each check:
  - **`quotes`:** `normalizeText(paras[lang][para-1]).includes(normalizeText(quote[lang]))`.
  - **`links`:** retry up to 3 times with a 20 s `AbortSignal.timeout`, a `User-Agent` header of a current desktop Chrome, and `redirect: 'follow'`. OK when `res.ok`.
  - **`sanity`:** last-Sunday check at level `warning`.
- [ ] **Step 5:** Run them. Expected: all pass.
- [ ] **Step 6:** Commit with the message "feat: content validators".

### Task 4: Design system and tokens

**Files:**
- Create: `design/tokens.json`, `scripts/tokens-to-css.ts`, `src/styles/tokens.css` (generated), `src/styles/global.css`, `tests/unit/tokens.test.ts`

**Interfaces:**
- Produces:
  - **CSS colour variables:** `--kumkum --haldi --marigold --peacock --mehendi --gulabi --chandan --text --white`.
  - **Font variables:** `--font-display: 'Rozha One', serif` and `--font-body: 'Mukta', system-ui, sans-serif`.
  - **Radius variables:** `--radius-card: 22px` and `--radius-arch: 999px 999px 18px 18px`.
  - **Section spacing:** `--space-section: 88px`.
  - **Motion classes:** `.bloom` (the scroll reveal) and `[data-countup]`.

- [ ] **Step 1:** Create the Claude Design System from the canvas's StyleTile board. Use `Artifact` quickstart `intent: "other"` and the Design System type, with the Utsav palette, type, radii and ornaments. Export its `tokens.json` to `design/tokens.json`. If an export isn't available, write `design/tokens.json` by hand from the Global Constraints values and note that in `docs/decisions.md`.
- [ ] **Step 2:** Write `tokens.test.ts`:
  - The generated CSS contains every palette variable with its exact hex.
  - **Contrast pairs:** every one of the following has a WCAG contrast of at least 4.5. Pairs: text on white, text on chandan, text on haldi, white on kumkum, white on peacock, white on mehendi, white on gulabi.
  - Marigold is only allowed for large text or decoration. Assert that `tokens.json` marks it `"usage": "decorative"`.
- [ ] **Step 3:** Run it. Expected: FAIL.
- [ ] **Step 4:** Implement `tokens-to-css.ts` and the npm script `tokens`. Write `global.css`:
  - **Base:** the Mukta body font, the Google Fonts `<link>` in the layout, and `.bloom` (opacity 0 and translateY 16px, then visible over 400 ms).
  - **Reduced motion:** `@media (prefers-reduced-motion: reduce)` turns off all animation and transition.
- [ ] **Step 5:** Run it. Expected: pass. If a contrast pair fails, adjust that shade in the tokens, record the change in `docs/decisions.md`, and update the canvas.
- [ ] **Step 6:** Commit with the message "feat: Utsav design tokens".

### Task 5: Ornament components

**Files:**
- Create: `src/components/ornaments/{Toran,Mandala,BlockBand,Kolam,Paisley,Ajrakh}.astro`, `tests/unit/ornaments.test.ts` (uses Astro's `experimental_AstroContainer`)

**Interfaces:**
- Produces:
  - `<Toran height?={76} />`
  - `<Mandala size={number} motif={Motif} spin?={boolean} />`
  - `<BlockBand variant="haldi"|"kumkum" />`
  - `<Kolam tone="haldi"|"mehendi" />`
  - `<Paisley corner="tl"|"br" />`
  - `<Ajrakh />`
  - Geometry copied from the canvas boards (Main.dc.html). Pattern ids must be unique per instance: append a counter-based suffix.

- [ ] **Step 1:** Write tests:
  - Each component renders an `<svg>` with `aria-hidden="true"`.
  - Two `<Kolam>` on one page give different pattern ids.
  - `<Mandala motif="diya">` contains `data-motif="diya"`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. The `Mandala` centre switches on `motif` (six small SVG glyphs). `spin` adds class `spin`, a 120 s linear rotation that is off under reduced motion.
- [ ] **Step 4:** Run them. Expected: pass.
- [ ] **Step 5:** Commit with the message "feat: Indian ornament components".

### Task 6: Content loader and i18n

**Files:**
- Create: `src/lib/content.ts`, `src/lib/i18n.ts`, `tests/unit/content.test.ts`

**Interfaces:**
- Consumes: the schemas (Task 2).
- Produces:
  - `loadEpisodes(dir = 'content/episodes'): Episode[]`: validated, sorted newest first. Throws if any file is invalid.
  - `loadSchemes(dir = 'content/schemes'): Map<string, Scheme>`
  - `deriveCounts(ep: Episode, schemes: Map<string, Scheme>): { topics: number; schemes: number; people: number; states: number }`: states is the distinct `places[].state`.
  - `buildTrends(eps: Episode[], lastN = 6): { months: string[]; rows: { category: Category; values: number[] }[] }`: the value is the number of topics in that category in that month.
  - `Lang` and `LANGS` are re-exported from schema.
  - `LANG_META: Record<Lang, { name: string; nativeName: string; dir: 'ltr'; machine: boolean; fonts: { display: string; body: string; googleFamilies: string } }>`
  - `t(lang: Lang, key: UiKey): string`, where `UiKey` covers every section label and title from the canvas. All seven languages are written in `i18n.ts`, and machine-language UI strings are reviewed for script correctness by tests.
  - `localePath(lang: Lang, path: string): string`: no prefix for `en`, `/<lang>` otherwise, and always the base.
  - `pick(b: Localized, lang: Lang): string`: falls back to `en` only for machine languages. It is never called for a language that isn't in `completeLangs`.
  - `completeLangs(ep: Episode, schemes: Map<string, Scheme>): Lang[]`: the same rule as the `languages` check.

- [ ] **Step 1:** Write tests:
  - `deriveCounts` on the fixture equals hand-computed values.
  - `buildTrends` with 2 fixture episodes gives the right counts, in oldest-to-newest month order.
  - `localePath('hi','/2026-10/') === '/mann-ki-baat/hi/2026-10/'` and `localePath('en','/2026-10/') === '/mann-ki-baat/2026-10/'`.
  - Every `UiKey` has a non-empty value in all 7 languages, and each non-en value passes `isMostlyScript` for its language.
  - `completeLangs` on a fixture with full kn and partial ta returns `['en','hi','kn']`.
  - `loadEpisodes` throws on a broken fixture directory.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expected: pass.
- [ ] **Step 5:** Commit with the message "feat: content loader and i18n".

### Task 7: Episode page (all languages)

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/episode/{Header,Hero,Glance,Topics,Quote,Schemes,People,Footer,MachineNotice}.astro`, `src/scripts/{filter,schemes,motion}.ts`, `src/pages/[month].astro` (en), `src/pages/[lang]/[month].astro` (one path for each non-en lang in `completeLangs`)
- Test: `tests/unit/episode-render.test.ts`

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces:
  - **Page props:** each page receives `{ episode, schemes, lang, prev?, next? }`.
  - **`getStaticPaths`:** returns one path per `loadEpisodes()` month.
  - **Hooks used by the client scripts:**
    - **Topics:** filter chips `button[data-filter]` and cards `[data-category]`.
    - **Schemes:** expandable cards `[data-scheme] > button[aria-expanded]`, the search box `#scheme-search`, and audience chips `button[data-audience]`.
    - **Motion:** count-up numbers `[data-countup]`.

- [ ] **Step 1:** Write render tests (Astro container, fixture episode):
  - The page contains the episode number and the `hi` headline on `/hi/`.
  - Filter chips render only for categories that are present, plus "All".
  - When `people` is empty, no People section is rendered (Review Focus 4).
  - A `mention-only` scheme renders the name, the one line and the official link, and has no "Who can apply" block.
  - The footer contains the exact disclaimer.
  - The quote has a figcaption with the paragraph number and an official link.
  - On `/kn/`:
    - `<html lang="kn">`.
    - The exact machine-translate notice appears near the top.
    - The Baloo Tamma 2 and Noto Sans Kannada font links are present.
    - The quote shows the Hindi original with the Kannada translation beneath it, labelled as a translation.
  - `getStaticPaths` for `[lang]` omits `ta` when ta is partial.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Build the components to match the canvas Main and Mobile boards. The language switch shows English and हिंदी as buttons, then a "More languages" menu listing the complete machine languages by native name. Use the theme accent from `episode.theme.accent` as the CSS variable `--accent` on `<body>`. The client scripts work as follows:
  - **`filter.ts`:** toggles `hidden` on the topic cards and sets `aria-pressed` on the chips.
  - **`schemes.ts`:** opens and closes the cards, and filters them by search text against the name, gives, audiences and states.
  - **`motion.ts`:** an IntersectionObserver adds `.visible` to `.bloom` elements and counts up numbers once. It does nothing under reduced motion.
  - **Language switch:** the switch links to the same month in the other language with the current `#hash`.
- [ ] **Step 4:** Run them. Expected: pass. Then run `npx astro build` with fixture content copied into `content/`. Expected: both `dist/2026-09/index.html` and `dist/hi/2026-09/index.html` exist.
- [ ] **Step 5:** Commit with the message "feat: episode page".

### Task 8: Places map

**Files:**
- Create: `src/data/india-states.geojson` (from D5), `src/lib/map.ts`, `src/components/episode/PlacesMap.astro`, `tests/unit/map.test.ts`

**Interfaces:**
- Produces:
  - `projectPlaces(places: Place[], width: number, height: number): { id: string; x: number; y: number }[]`
  - `statePaths(width, height): string[]` using d3-geo `geoMercator().fitSize`.
  - The SVG is rendered at build time. There is no client-side map library.

- [ ] **Step 1:** Write tests:
  - A pin for New Delhi (28.61, 77.21) lands inside the bounding box of the Delhi state path.
  - `statePaths` returns at least 28 paths.
  - With zero places, the component renders nothing.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Pins are numbered to match the place list beside the map. The SVG gets `role="img"` and an `aria-label` that lists the places.
- [ ] **Step 4:** Run them. Expected: pass.
- [ ] **Step 5:** Commit with the message "feat: build-time India map".

### Task 9: Home, archive, trends, scheme index, translate menu

**Files:**
- Create: `src/components/home/{LatestBanner,ArchiveGrid,Trends}.astro`, `src/pages/{index,schemes}.astro`, `src/pages/[lang]/{index,schemes}.astro`, `src/components/LanguageMenu.astro`, `tests/unit/home-render.test.ts`

**Interfaces:**
- Consumes: `buildTrends`, `loadSchemes`, `completeLangs`, `LANG_META` (Task 6). D4 is decided: there is no third-party translate script.

- [ ] **Step 1:** Write tests:
  - The home page shows the newest episode in the banner.
  - The archive has one card per episode, in the episode's accent colour.
  - The trends grid has `lastN` columns and is hidden if there are fewer than 2 episodes.
  - The scheme index lists every scheme with an official link and the months it was mentioned.
  - `LanguageMenu` lists the machine languages complete for the latest episode, by native name. It also has an "Other languages" item that opens (a `<details>` element, no JS) a short guide to the browser's "Translate this page" for Chrome/Android, Edge and Safari. The guide includes the exact machine-translate notice.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement to match the canvas Archive board.
  - **Trends:** a "flower" grid whose circle size scales with `values` (minimum 10 px, maximum 42 px).
  - **Machine-language home and schemes pages:** these exist for each language complete in the latest episode.
- [ ] **Step 4:** Run them. Expected: pass.
- [ ] **Step 5:** Commit with the message "feat: home, archive, trends, schemes index, translate menu".

### Task 10: Site validators and deploy workflow

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/pages.spec.ts`, `lighthouserc.json`, `scripts/size-budget.ts`, `.github/workflows/deploy.yml`

**Interfaces:**
- Produces:
  - **npm scripts:** `validate:site` (Playwright, axe and the size budget), `lhci`.
  - **Workflow:** on push to `main` and on `workflow_dispatch`, it runs `npm ci`, `npm run tokens`, `vitest run`, `astro build`, `validate:site` and `lhci`. Then `actions/upload-pages-artifact` and `actions/deploy-pages`.

- [ ] **Step 1:** Write `pages.spec.ts`, which runs against `astro preview`. For `/`, `/2026-09/`, `/hi/2026-09/` and `/kn/2026-09/` (the fixture has complete kn), at 1440×900 and 390×844, it checks:
  - No console errors.
  - axe finds no `serious` or `critical` violations.
  - `document.documentElement.scrollWidth <= innerWidth` (Review Focus 5).
  - Clicking the "Environment" chip hides cards that aren't Environment.
  - Clicking a scheme header sets `aria-expanded="true"`.
  - The language switch on `/2026-09/#schemes` navigates to `/hi/2026-09/#schemes`.
- [ ] **Step 2:** Run `npm run validate:site`. Expected: these pass against the fixture build. Fix any failures in the components, not in the tests.
- [ ] **Step 3:** Write `size-budget.ts`. It fails if an episode page's HTML plus CSS plus JS is over 300 KB. Write `lighthouserc.json` asserting `categories:performance >= 0.9` with the mobile preset.
- [ ] **Step 4:** Write `deploy.yml`. Push it, enable Pages with source "GitHub Actions" (`gh api repos/yawdor/mann-ki-baat/pages -X POST -f build_type=workflow`), and confirm the run is green and `https://yawdor.github.io/mann-ki-baat/` serves the fixture site.
- [ ] **Step 5:** Commit with the message "ci: site validators and Pages deploy".

### Task 11: Pipeline helpers

**Files:**
- Create: `pipeline/window.ts`, `pipeline/paras.ts`, `pipeline/fetch.ts`, `pipeline/publish.ts`, `pipeline/cli.ts` (subcommands `should-run`, `save-sources <month> <enUrl> <hiUrl>`, `publish <month>`; prints JSON), `tests/unit/pipeline.test.ts`, `tests/fixtures/transcripts/{en,hi}.html` (saved from D3)

**Interfaces:**
- Consumes: D3 selectors and `runContentValidation` (Task 3).
- Produces:
  - `targetMonth(now: Date): string | null`: works in IST. Days 26 to the end of the month give month M. Days 1–4 give month M−1. Anything else gives `null`.
  - `shouldRun(now: Date, root: string): { run: boolean; month: string | null; reason: string }`: returns `run: false` if `content/episodes/<month>.json` exists.
  - `extractParagraphs(html: string, selector: string): string[]`: non-empty, normalised paragraphs, in order.
  - `saveSources(month, urls: { en: string; hi: string }, opts: { root; fetch }): Promise<void>`: writes the HTML files, `*.paras.json`, and `meta.json` with `{ urls, fetchedAt, sha256 }`.
  - `publish(month, report, opts: { root; dryRun? }): Promise<{ branch: 'main' | `drafts/${string}` }>`: if `report.ok`, commits `content/` and `sources/` to `main`. Otherwise it pushes the branch `drafts/<month>`, adds `reports/<month>.content.json`, and leaves `main` untouched.

- [ ] **Step 1:** Write tests:
  - `targetMonth(2026-10-26T06:00Z) === '2026-10'`
  - `targetMonth(2027-01-02T06:00Z) === '2026-12'` (Review Focus 2)
  - `targetMonth(2026-10-15T06:00Z) === null`
  - At 20:00 UTC on 25 Oct, IST is already 26 Oct, so `targetMonth(2026-10-25T20:00Z) === '2026-10'`.
  - `shouldRun` returns false when the fixture month file exists.
  - `extractParagraphs` on the en fixture returns a count equal to the number of paragraphs counted by hand from D3.
  - `publish` with a failing report and `dryRun` returns a `drafts/` branch.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. `publish` shells out to `git` through `execFile`, with no shell string interpolation.
- [ ] **Step 4:** Run them. Expected: pass.
- [ ] **Step 5:** Commit with the message "feat: pipeline helpers".

### Task 12: Routine instructions, notification, and launch

**Files:**
- Create: `pipeline/ROUTINE.md` (the routine's prompt), `pipeline/notify.md` (email templates), `pipeline/EXTRACT_RULES.md`

**Interfaces:**
- Consumes: everything above, plus D1 and D2.

- [ ] **Step 1:** Write `EXTRACT_RULES.md`, the rules the model follows when writing the episode JSON:
  - Quotes are copied exactly, never paraphrased.
  - Every fact cites a paragraph.
  - People, places and numbers appear only if they are in the transcript.
  - The theme accent and motif are chosen from the main topic using the mapping: festivals/culture → kumkum/diya; environment/water → mehendi/lotus; agriculture → haldi/wheat; science/space/youth → peacock/wheel; women/family → gulabi/mandala.
  - Schemes are `full` only when they come from an official page read in this run, or from an existing record whose `checkedAt` is less than 180 days old.
  - Hindi quotes come from `hi.paras.json`, and Hindi scheme names use their official Hindi form.
  - After en and hi are complete, translate every text field into kn, ta, te, bn and mr in the same file. Scheme names stay in their official English name plus the translation in brackets. Quotes get a translation; the Hindi original is kept verbatim. A language that can't be finished is left out entirely; it is never left partial.
- [ ] **Step 2:** Write `ROUTINE.md`. It runs these steps in order:
  1. `npx tsx pipeline/cli.ts should-run`. Exit if it says no.
  2. Discover the URLs (D3).
  3. `saveSources`.
  4. Write the episode and scheme JSON following `EXTRACT_RULES.md`.
  5. `npm run validate:content -- <month>`.
  6. `publish`.
  7. Send the email using `notify.md`: live, draft-failed, or no-transcript after day 4.
  8. Never edit anything outside `content/`, `sources/` or `reports/`.
- [ ] **Step 3:** Write `notify.md` templates:
  - **Success:** subject "✅ Mann Ki Baat <Month YYYY> is live", with the link.
  - **Failure:** subject "⚠️ Mann Ki Baat <Month YYYY> not published", with each failed check and the drafts branch link.
  - **Missing:** subject "ℹ️ No Mann Ki Baat transcript found for <Month YYYY>".
- [ ] **Step 4 (launch, live with the owner):** Follow `ROUTINE.md` by hand in a session for **2026-10**. Expected:
  - The content validator report has `ok: true`, or it lists the failures, which you fix and re-run.
  - The push to `main` gives a green deploy.
  - `https://yawdor.github.io/mann-ki-baat/2026-10/` and `/hi/2026-10/` render.
  - The email arrives.
  - Remove the fixture episode from `content/` (keep it in `tests/fixtures/`).
- [ ] **Step 5:** Create the real routine with the `schedule` skill: cron `0 6 26-31,1-4 * *` (UTC), with `ROUTINE.md` as its prompt and repo `yawdor/mann-ki-baat`. If D1 failed, use the fallback instead: a GitHub Actions workflow `monthly.yml` on the same cron. Trigger a manual run now. Expected: it says no ("2026-10 already published") and sends no email.
- [ ] **Step 6:** Commit with the message "feat: monthly routine". Update the README with how it works, how to roll back (`git revert <episode commit>`), and how to fix a month.
