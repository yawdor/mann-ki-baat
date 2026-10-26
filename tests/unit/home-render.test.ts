import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse, type HTMLElement } from 'node-html-parser';
import HomeEn from '../../src/pages/index.astro';
import HomeLang from '../../src/pages/[lang]/index.astro';
import SchemesEn from '../../src/pages/schemes.astro';
import SchemesLang from '../../src/pages/[lang]/schemes.astro';
import EpisodeEn from '../../src/pages/[month].astro';
import EpisodeLang from '../../src/pages/[lang]/[month].astro';
import HomePage from '../../src/components/home/HomePage.astro';
import { enPaths, langPaths } from '../../src/lib/episode-paths';
import { flowerSize, homeLangs, homePaths, homeProps } from '../../src/lib/home-paths';
import { loadEpisodes, loadSchemes } from '../../src/lib/content';
import { t } from '../../src/lib/i18n';

const FX = 'tests/fixtures';
process.env.MKB_CONTENT_DIR = FX;
const eps = () => loadEpisodes(`${FX}/episodes`);
const schemes = () => loadSchemes(`${FX}/schemes`);
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});
afterEach(() => {
  process.env.MKB_CONTENT_DIR = FX;
});

type AnyPage = Parameters<AstroContainer['renderToString']>[0];
async function render(page: AnyPage, props: Record<string, unknown> = {}, params: Record<string, string> = {}) {
  const html = await container.renderToString(page, { props, params, partial: false });
  return parse(html);
}

const home = async (lang: string) => {
  if (lang === 'en') return render(HomeEn);
  const p = homePaths().find((x) => x.params.lang === lang);
  if (!p) throw new Error(`no home for ${lang}`);
  return render(HomeLang, p.props, p.params);
};
const schemesPage = async (lang: string) => {
  if (lang === 'en') return render(SchemesEn);
  const p = homePaths().find((x) => x.params.lang === lang)!;
  return render(SchemesLang, p.props, p.params);
};

describe('home — latest banner', () => {
  it('shows the newest episode', async () => {
    const doc = await home('en');
    const banner = doc.querySelector('.latest')!;
    expect(banner.getAttribute('href')).toBe('/mann-ki-baat/2026-09/');
    expect(banner.querySelector('h1, .headline')!.text).toContain('Sample Episode: Together We Grow');
    expect(squash(banner.text)).toContain('138');
    expect(squash(banner.text)).toContain(t('en', 'ctaExplainer'));
    expect(banner.querySelector('svg[data-motif="wheat"]')).not.toBeNull();
  });

  it('meta: canonical, hreflang for home languages, og:type website', async () => {
    const doc = await home('en');
    expect(doc.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe('https://yawdor.github.io/mann-ki-baat/');
    const alts = doc.querySelectorAll('link[rel="alternate"]').map((l) => l.getAttribute('hreflang'));
    expect(alts.sort()).toEqual(['en', 'hi', 'kn']);
    expect(doc.querySelector('meta[property="og:type"]')!.getAttribute('content')).toBe('website');
  });
});

describe('home — archive', () => {
  it('has one arch card per episode, newest first, in the episode accent', async () => {
    const doc = await home('en');
    const cards = doc.querySelectorAll('#archive a.arch');
    expect(cards.map((c) => c.getAttribute('data-month'))).toEqual(['2026-09', '2026-08']);
    expect(cards[0].getAttribute('style')).toContain('#118754');
    expect(cards[1].getAttribute('style')).toContain('#B0124A');
    expect(cards[0].text).toContain('Sample Episode: Together We Grow');
    expect(squash(cards[0].text)).toContain('September 2026');
    expect(squash(cards[0].text)).toContain(`${t('en', 'navTopics')}: 4`);
    expect(squash(cards[0].text)).toContain(`${t('en', 'navSchemes')}: 1`);
    expect(cards[1].getAttribute('href')).toBe('/mann-ki-baat/2026-08/');
  });

  it('machine-language cards link in that language when complete, else English with hreflang', async () => {
    const doc = await home('kn');
    const cards = doc.querySelectorAll('#archive a.arch');
    expect(cards[0].getAttribute('href')).toBe('/mann-ki-baat/kn/2026-09/');
    expect(cards[1].getAttribute('href')).toBe('/mann-ki-baat/2026-08/');
    expect(cards[1].getAttribute('hreflang')).toBe('en');
    expect(cards[0].text).toContain('ಮಾದರಿ ಸಂಚಿಕೆ: ಒಟ್ಟಿಗೆ ಬೆಳೆಯೋಣ');
  });
});

describe('home — trends', () => {
  it('has one column per month (up to lastN) with an accessible summary and data table', async () => {
    const doc = await home('en');
    const grid = doc.querySelector('#trends [role="img"]')!;
    expect(grid.getAttribute('aria-label')!.length).toBeGreaterThan(10);
    expect(grid.querySelectorAll('.month-head')).toHaveLength(2);
    const table = doc.querySelector('#trends .visually-hidden > table')!;
    expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(3);
    const env = table.querySelectorAll('tbody tr').find((r) => r.text.includes('Environment'))!;
    expect(env.querySelectorAll('td').map((td) => td.text.trim())).toEqual(['1', '1']);
  });

  it('is hidden when there are fewer than 2 episodes', async () => {
    const doc = await render(HomePage, homeProps('en', eps().slice(0, 1), schemes()));
    expect(doc.querySelector('#trends')).toBeNull();
    expect(doc.querySelectorAll('#archive a.arch')).toHaveLength(1);
  });

  it('flower size scales from 10px to 42px over the max value', () => {
    expect(flowerSize(0, 4)).toBe(0);
    expect(flowerSize(4, 4)).toBe(42);
    expect(flowerSize(1, 100)).toBeGreaterThanOrEqual(10);
    expect(flowerSize(2, 4)).toBeGreaterThan(flowerSize(1, 4));
  });
});

describe('scheme index', () => {
  it('lists every scheme with its audiences, official link and the months it was mentioned', async () => {
    const doc = await schemesPage('en');
    const rows = doc.querySelectorAll('#scheme-list tbody tr[data-scheme]');
    expect(rows.map((r) => r.getAttribute('data-scheme')).sort()).toEqual(['pm-kisan', 'sample-mention']);
    const kisan = rows.find((r) => r.getAttribute('data-scheme') === 'pm-kisan')!;
    expect(kisan.text).toContain('PM-KISAN');
    expect(kisan.text).toContain('Farmers');
    expect(kisan.querySelector('a[href="https://pmkisan.gov.in/"]')).not.toBeNull();
    expect(kisan.querySelector('a[href="/mann-ki-baat/2026-09/#scheme-pm-kisan"]')).not.toBeNull();
    const mention = rows.find((r) => r.getAttribute('data-scheme') === 'sample-mention')!;
    expect(mention.querySelector('a[href="https://www.india.gov.in/"]')).not.toBeNull();
    expect(mention.querySelector('a[href="/mann-ki-baat/2026-08/"]')).not.toBeNull();
    expect(doc.querySelector('#scheme-search')).not.toBeNull();
    expect(doc.querySelector('#scheme-list .empty')).not.toBeNull();
    expect(doc.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe('https://yawdor.github.io/mann-ki-baat/schemes/');
  });

  it('the home page shows the index too, linking to the searchable page', async () => {
    const doc = await home('hi');
    expect(doc.querySelectorAll('#index tbody tr[data-scheme]')).toHaveLength(2);
    expect(doc.querySelector('#index a[href="/mann-ki-baat/hi/schemes/"]')).not.toBeNull();
    expect(doc.querySelector('#index')!.text).toContain('पीएम-किसान');
  });

  it('machine languages fall back to English scheme names and show the notice', async () => {
    const doc = await schemesPage('kn');
    expect(doc.querySelector('html')!.getAttribute('lang')).toBe('kn');
    expect(squash(doc.querySelector('.machine-notice')!.text)).toContain(t('kn', 'machineNotice'));
    const kisan = doc.querySelector('tr[data-scheme="pm-kisan"]')!;
    expect(kisan.text).toContain('PM-KISAN');
    expect(kisan.querySelector('a[href="/mann-ki-baat/kn/2026-09/#scheme-pm-kisan"]')).not.toBeNull();
  });
});

describe('LanguageMenu', () => {
  it('lists machine languages complete for the latest episode by native name, plus an Other languages guide', async () => {
    const doc = await home('en');
    const menu = doc.querySelector('.lang-switch')!;
    const hrefs = menu.querySelectorAll('a[hreflang]').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/mann-ki-baat/', '/mann-ki-baat/hi/', '/mann-ki-baat/kn/']);
    expect(menu.text).toContain('ಕನ್ನಡ');
    expect(menu.text).not.toContain('தமிழ்');
    const other = menu.querySelector('details.other')!;
    expect(other.querySelector('summary')!.text).toContain(t('en', 'otherLanguages'));
    const guide = squash(other.text);
    for (const b of ['Chrome', 'Android', 'Edge', 'Safari']) expect(guide).toContain(b);
    expect(guide).toContain('Machine-translated — check official links for exact eligibility.');
    expect(doc.querySelectorAll('script').some((s) => /translate\.google|bhashini/i.test(s.toString()))).toBe(false);
  });

  it('is the same component on episode pages', async () => {
    const p = enPaths(eps(), schemes())[0];
    const doc = await render(EpisodeEn, p.props, p.params);
    expect(doc.querySelector('.lang-switch details.other')).not.toBeNull();
    expect(doc.querySelector('a.brand')!.getAttribute('href')).toBe('/mann-ki-baat/');
  });
});

describe('paths', () => {
  it('home and schemes exist for en, hi and kn, not ta', () => {
    expect(homeLangs(eps(), schemes())).toEqual(['en', 'hi', 'kn']);
    expect(homePaths(eps(), schemes()).map((p) => p.params.lang)).toEqual(['hi', 'kn']);
  });

  it('hi home exists even with zero episodes', () => {
    expect(homePaths([], new Map()).map((p) => p.params.lang)).toEqual(['hi']);
  });

  it('episode pages link home in English when their language has no home page', () => {
    const [sep, aug] = eps();
    const older = structuredClone(sep);
    const newer = structuredClone(aug);
    newer.date = '2026-10-25';
    newer.episode = 139;
    const kn = langPaths([newer, older], schemes()).find((p) => p.params.lang === 'kn')!;
    expect(kn.props.homeLang).toBe('en');
    const hi = langPaths([newer, older], schemes()).find((p) => p.params.lang === 'hi')!;
    expect(hi.props.homeLang).toBe('hi');
  });
});

describe('zero episodes', () => {
  it('home builds with a coming-soon state; scheme index shows its empty state', async () => {
    process.env.MKB_CONTENT_DIR = mkdtempSync(join(tmpdir(), 'mkb-empty-'));
    const doc = await render(HomeEn);
    expect(squash(doc.querySelector('main')!.text)).toContain(t('en', 'comingSoon'));
    expect(doc.querySelector('#archive a.arch')).toBeNull();
    expect(doc.querySelector('#trends')).toBeNull();
    const s = await render(SchemesEn);
    expect(squash(s.querySelector('main')!.text)).toContain(t('en', 'noSchemesYet'));
  });
});

describe('every internal link resolves to a built page', () => {
  it('across all fixture pages', async () => {
    const pages: { path: string; doc: HTMLElement }[] = [];
    pages.push({ path: '/mann-ki-baat/', doc: await render(HomeEn) });
    pages.push({ path: '/mann-ki-baat/schemes/', doc: await render(SchemesEn) });
    for (const p of homePaths()) {
      pages.push({ path: `/mann-ki-baat/${p.params.lang}/`, doc: await render(HomeLang, p.props, p.params) });
      pages.push({ path: `/mann-ki-baat/${p.params.lang}/schemes/`, doc: await render(SchemesLang, p.props, p.params) });
    }
    for (const p of enPaths()) pages.push({ path: `/mann-ki-baat/${p.params.month}/`, doc: await render(EpisodeEn, p.props, p.params) });
    for (const p of langPaths())
      pages.push({ path: `/mann-ki-baat/${p.params.lang}/${p.params.month}/`, doc: await render(EpisodeLang, p.props, p.params) });

    const ids = new Map(pages.map((p) => [p.path, new Set(p.doc.querySelectorAll('[id]').map((e) => e.id))]));
    const broken: string[] = [];
    for (const { path, doc } of pages) {
      for (const a of doc.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href')!;
        if (/^https?:/.test(href)) continue;
        const [p, hash] = href.startsWith('#') ? [path, href.slice(1)] : href.split('#');
        if (!ids.has(p)) broken.push(`${path} → ${href} (no page)`);
        else if (hash && !ids.get(p)!.has(hash)) broken.push(`${path} → ${href} (no #${hash})`);
      }
    }
    expect(broken).toEqual([]);
    expect(pages.map((p) => p.path).sort()).toEqual([
      '/mann-ki-baat/', '/mann-ki-baat/2026-08/', '/mann-ki-baat/2026-09/',
      '/mann-ki-baat/hi/', '/mann-ki-baat/hi/2026-08/', '/mann-ki-baat/hi/2026-09/', '/mann-ki-baat/hi/schemes/',
      '/mann-ki-baat/kn/', '/mann-ki-baat/kn/2026-09/', '/mann-ki-baat/kn/schemes/',
      '/mann-ki-baat/schemes/',
    ]);
  });
});
