# Task 0 research (26 Oct 2026)

## D3 - Transcript sources (pmindia.gov.in)

The 139th episode (25 Oct 2026) IS already published, in both languages. All fetched with plain curl and a Mozilla UA.

| Item | Value |
|---|---|
| EN 139th | https://www.pmindia.gov.in/en/news_updates/pms-address-in-the-139th-episode-of-mann-ki-baat/ (200, 81 KB, dated "25 Oct, 2026"). Saved as d3-en.html |
| HI 139th | https://www.pmindia.gov.in/hi/news_updates/%e0%a4%ae%e0%a4%a8-%e0%a4%95%e0%a5%80-%e0%a4%ac%e0%a4%be%e0%a4%a4-%e0%a4%95%e0%a5%80-139%e0%a4%b5%e0%a5%80%e0%a4%82-%e0%a4%95%e0%a5%9c%e0%a5%80-%e0%a4%ae%e0%a5%87%e0%a4%82-%e0%a4%aa%e0%a5%8d%e0%a4%b0/ (200, 171 KB). Saved as d3-hi.html. Decoded slug: मन-की-बात-की-139वीं-कड़ी-में-प्र (slug is truncated; the Hindi `<h2>` is "मन की बात की 139वीं कड़ी में प्रधानमंत्री के सम्बोधन का मूल पाठ (25.10.2026)") |
| Also saved | d3-en-138.html, d3-hi-138.html (Sep 27 2026 episode, 138th) for comparison |

### URL pattern
- EN: `/en/news_updates/pms-address-in-the-{N}{th|st|nd|rd}-episode-of-mann-ki-baat/` (136th, 137th, 138th, 139th confirmed; ordinal suffixes vary: 131st, 132nd, 133rd).
- HI: `/hi/news_updates/मन-की-बात-की-{N}वीं-कड़ी-में-प्र/` (percent-encoded lowercase hex). Pattern worked by swapping 138 to 139. Older episodes may have different slugs (e.g. with ordinal forms such as 1xxवीं); verify.
- The EN page has NO link to the HI page (no hreflang/language link found in the 139th page). The 138th EN page did contain a `hi/news_updates/...138...` link in its HTML, so EN to HI cross-link is inconsistent. Safer to derive the HI URL by pattern and also discover it from the HI listing.
- Guessing a nonexistent URL returns 200 with a title only if the post exists. I did not test what a missing one returns (likely WP 404 page).

### Listing / discovery
- `https://www.pmindia.gov.in/en/tag/mann-ki-baat/` (200, 76 KB). Items are `<a href=".../en/news_updates/pms-address-in-the-NNNth-episode-of-mann-ki-baat/?tag_term=mann-ki-baat&comment=disable" title="PM's address in the NNNth Episode ...">` newest first, each with `<span class="date">Sep 27, 2026</span>`. Newest = first match; episode number is parsed from the title.
- `https://www.pmindia.gov.in/en/mann-ki-baat/` (200, 63 KB) also lists episodes (links without query string, each twice).
- `https://www.pmindia.gov.in/hi/tag/mann-ki-baat/` returned 301 (redirect, not followed in my test; use `-L`). `/hi/mann-ki-baat/` redirects to the EN page.
- LAG WARNING: on 26 Oct both EN listing pages still showed 138th as newest (no "139th" string), although the 139th article was live. A cron job that relies only on the listing will lag; also probe the predicted URL (N+1) directly.
- Episode date: `<span class="date" >25 Oct, 2026</span>` inside `div.share_date` on the article page (listing uses "Sep 27, 2026" format).

### Transcript structure (raw HTML)
- Title: `<h2>` inside `div.content-block` (EN: "PM's address in the 139th Episode of Mann Ki Baat"). Episode number appears in `<h2>`, `<title>`, `og:title`, and URL (EN); HI: `<h2>` has "139वीं" plus date "(25.10.2026)". Page also contains an unrelated `Date : 25-01-2017` string (site template) - do not use it.
- Transcript body: `div.news-bg > p` (siblings after `div.single-image-align` which holds the YouTube iframe `<p><iframe ...></p>`). The `div.news-bg` ends before `div.tweet-container` (embedded tweets, which also contain `<p>` - exclude them).
- Paragraph counts (138th, measured on the bytes between `<div class='news-bg'>` and `tweet-container`): EN 138th has 68-69 `<p>`; EN 139th: 69 `<p>` incl. the YouTube-less ones, about 21 KB text; HI 139th: 53 `<p>`, about 93 K chars (Hindi paragraphs longer); HI 138th: 68. Counts include a junk first `<p>` (stray `<!DOCTYPE ...>` + `<br>`; yields text ">>>") and a last `<p><strong>Namaskar.</strong></body></html></p>` - the markup is malformed (use a real HTML parser like cheerio/parse5, and filter empty / ">>>" paragraphs). Bold `<strong>` paragraphs are speaker notes/greetings.
- Page is server-rendered: full transcript is in the raw HTML, NO JavaScript needed. (jQuery on the page only adds share buttons.)
- No bot blocking observed: all requests 200 with UA "Mozilla/5.0" via curl (a default UA was not tested). No 403/429. robots.txt returned 301 (not followed). `pib.gov.in` was not usable for this (I did not find a stable transcript URL; a test PRID returned 404). pmindia is sufficient.
- Audio/video: YouTube embed ID in the first iframe (e.g. 138th: PRIbIpyg3Ks).
- Caveat: the 139th page is "the original text" (EN is the PMO's English translation of the Hindi speech, HI is the original). Check the 139th is complete before publishing (the 25 Oct page was fully formed when fetched).

## D4 - Machine translation on a static site

| Option | Status / terms | Verdict |
|---|---|---|
| (a) Google Website Translator (`translate.google.com/translate_a/element.js`) | Google's announcement (via wphive.com/?p=38987, which cites developers.google.com/search/blog/2020/05/google-translates-website-translator, updated 1 Sep 2026) says the widget is "no longer supported" from 1 Oct 2026. I could not fetch Google's page itself (secondary source only). Technical check on 26 Oct: the script still returns HTTP 200 (2.9 KB loader, build id TE_20261025) and loads its main JS from translate.googleapis.com, so it still serves today - but unsupported and may be switched off any time; no new commercial installs since 2019; no SLA; ToS-wise it is a free widget with Google branding. Page-translation widget also replaces DOM text at runtime, translates 100+ languages. | Works now but a retired product - do not build on it as the only mechanism |
| (b) Bhashini (bhashini.gov.in / ULCA / Dhruva) | Could not fetch official docs (bhashini.gov.in/ulca/apis rendered no content; dhruva-api unreachable from curl). From third-party sources only (ecorpit.com blog, github.com/vinayakjaas/sb_translate - unverified): access requires registration on the ULCA portal with email verification, generating an API key + user ID (max 5 keys), a 3-step pipeline (search, config, compute), and docs say "proof of concept only"; production use needs contacting the Bhashini team. No official embeddable widget found. A browser-side call would expose the key (CORS behaviour unverified), and a static site has no server to hide it. Covers 22 scheduled Indian languages (+English) - not "any language". | Not suitable for key-less static hosting; consider only for pre-translating content at build time into Indian languages, subject to their terms |
| (c) Others | 1) Browser built-in translation (Chrome, Edge, Safari translate the page; free, no code; make sure `<html lang>` is correct and do not add `translate="no"` to content). 2) Build-time/pre-translation with your own key (Cloud Translation: $20/M chars, first 500K chars/month free per wphive; or other LLM/MT APIs) committed as static JSON/HTML per language - no secret exposure, works offline, but only for chosen languages and costs per episode. 3) GTranslate free widget (third party, non-commercial, per wphive; wraps Google). 4) Self-hosted in-browser models (Bergamot/Firefox Translations via WASM, Transformers.js with NLLB/Opus) - free, no key, but heavy downloads and uneven quality for Indic languages. | |

**Recommendation:** English + Hindi are the first-class, pre-built pages (official text, no MT). For "any other language": (1) keep `<html lang>` correct and add a visible hint that the browser's native Translate (Chrome/Edge/Safari) works - zero maintenance; (2) optionally add the Google element.js widget as a best-effort, lazy-loaded, clearly-labelled "machine translation, may stop working" extra, behind a graceful fallback (it still loads 26 Oct 2026); (3) if a few more languages matter (e.g. Tamil, Telugu, Bengali, Marathi), pre-translate at build time rather than runtime, using a key held only in the GitHub Actions secret. Avoid Bhashini in the browser because of the key exposure and "PoC" terms.

## D5 - India state boundary data

Findings from actual downloads and bbox checks (not just READMEs).

| Candidate | URL | Licence | Features | Size | State name property | Boundary check |
|---|---|---|---|---|---|---|
| **udit-001/india-maps-data** `geojson/india.geojson` (district level; dissolve by state to get states) | https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson (jsDelivr: https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@2884453/geojson/india.geojson) | **None stated** (README: curated from public sources, "personal usage", no liability). Underlying data looks like DataMeet / Census 2011 (`year: "2011_c"`). Do not rely on it without checking. | 760 districts, 36 states/UTs (incl. J&K, Ladakh, DNH&DD merged, Telangana) | 4.09 MB GeoJSON (topojson/ also exists) | `st_nm` (also `st_code`, `district`, `dt_code`) | Ladakh/Leh bbox lon 72.5-80.3, lat 32.3-37.1, so it includes Gilgit-Baltistan and Aksai Chin per India's claim; J&K has Muzaffarabad and Mirpur (PoK). Matches India's official depiction. Per-state files also exist in `geojson/states/` (e.g. ladakh.geojson, 2 features, 124 KB) |
| **ramSeraph/indian_admin_boundaries** SOI_States (Survey of India source) | https://github.com/ramSeraph/indian_admin_boundaries/releases/tag/states ; assets: SOI_States.geojsonl.7z (9.1 MB), SOI_States.parquet (19 MB), SOI_States.pmtiles (5.6 MB); also LGD_States (6.5 MB 7z), bhuvan_states (1.3 MB 7z) | CC0 1.0 with request to credit DataMeet and the original government source (https://github.com/ramSeraph/indianopenmaps/blob/main/DATA_LICENSE.md) - repo README quotes the Govt. Geospatial Guidelines allowing SoI digital boundary data to be freely used. Not downloaded or counted by me. | not checked (state count not verified) | too big raw; needs simplification (mapshaper) | not checked | Official SoI source, so presumably matches official boundaries - verify bbox after download |
| **datameet/maps** `Country/india-soi.geojson` / `india-composite.geojson` | https://github.com/datameet/maps/tree/master/Country | Repo default CC BY 4.0; composite = CC0; india-soi = CC-BY-SA 2.5 / ODbL | single country outline (land incl. disputed) | 10.8 MB / 12.3 MB | n/a (country only; states are in `States/Admin2` shapefile, CC BY 4.0, Census based - not inspected) | Composite README says it follows the SoI official boundary. Good for an outline |

**Suggested plan:** take SOI_States (or state-dissolved udit data), simplify with mapshaper to ~200-400 KB TopoJSON, check bbox of Ladakh reaches lat ~37.1 / lon 72.5-80.3 (Gilgit-Baltistan + Aksai Chin) and Arunachal includes full claimed area, keep CC0 credit "Survey of India boundaries via DataMeet / ramSeraph", add the standard note "map is for illustration; boundaries as per Survey of India".

**Avoid:**
- Tanmay53/india-state-boundries-geojson: Apache-2.0, but `india_states.geojson` is a Git LFS pointer (raw URL returns a 134-byte pointer to a 164 MB file) - unusable via raw URL and too big; boundary depiction unchecked.
- Natural Earth admin-1 / admin-0 (de facto depiction, shows Kashmir differently), geoBoundaries, GADM, OSM-derived (e.g. india-osm.geojson, world-geojson npm) - depict disputed areas differently (Aksai Chin / PoK / Gilgit-Baltistan treated as non-Indian or dashed). Not individually verified; names only.
- Any pre-2019 file with a single "Jammu and Kashmir" (no Ladakh UT) and pre-2020 files where DNH and Daman & Diu are separate.

## Blockers / unverified
- Bhashini official docs and Google's own retirement post could not be fetched (secondary sources only).
- SOI_States release not downloaded/inspected (7z); udit data inspected only for J&K/Ladakh.
- PIB transcript URLs not located.
