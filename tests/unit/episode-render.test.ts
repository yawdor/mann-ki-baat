import { beforeAll, describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse, type HTMLElement } from 'node-html-parser';
import EnPage from '../../src/pages/[month].astro';
import LangPage from '../../src/pages/[lang]/[month].astro';
import { enPaths, langPaths, type EpisodePageProps } from '../../src/lib/episode-paths';
import { loadEpisodes, loadSchemes } from '../../src/lib/content';
import { t } from '../../src/lib/i18n';
import type { Episode } from '../../src/lib/schema';

const eps = () => loadEpisodes('tests/fixtures/episodes');
const schemes = () => loadSchemes('tests/fixtures/schemes');

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

async function renderPath(lang: string, month: string): Promise<{ html: string; doc: HTMLElement }> {
  const paths: { params: Record<string, string>; props: EpisodePageProps }[] =
    lang === 'en' ? enPaths(eps(), schemes()) : langPaths(eps(), schemes());
  const p = paths.find((x) => x.params.month === month && (lang === 'en' || x.params.lang === lang));
  if (!p) throw new Error(`no path for ${lang}/${month}`);
  return renderProps(p.props, p.params);
}

async function renderProps(props: EpisodePageProps, params: Record<string, string>) {
  const page = props.lang === 'en' ? EnPage : LangPage;
  const html = await container.renderToString(page, { props, params, partial: false });
  return { html, doc: parse(html) };
}

describe('episode page — en', () => {
  it('shows the episode number, headline, accent and canonical/hreflang links', async () => {
    const { doc } = await renderPath('en', '2026-09');
    expect(doc.querySelector('html')!.getAttribute('lang')).toBe('en');
    expect(doc.querySelector('h1')!.text).toContain('Sample Episode: Together We Grow');
    expect(doc.querySelector('.dateline')!.text).toContain('138');
    expect(doc.querySelector('body')!.getAttribute('style')).toContain('--accent: #118754');
    expect(doc.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(
      'https://yawdor.github.io/mann-ki-baat/2026-09/',
    );
    const alts = doc.querySelectorAll('link[rel="alternate"]').map((l) => l.getAttribute('hreflang'));
    expect(alts.sort()).toEqual(['en', 'hi', 'kn']);
    expect(doc.querySelector('meta[property="og:type"]')!.getAttribute('content')).toBe('article');
  });

  it('shows the summary in At a glance and the generic dek in the hero (summary once)', async () => {
    const { doc } = await renderPath('en', '2026-09');
    const summary = 'Synthetic sample data for testing. Farmers share storage, a neighbour cleans a river, a folk dance returns and students build an alarm.';
    expect(doc.querySelector('#glance .summary')!.text).toBe(summary);
    expect(doc.querySelector('#top .dek')!.text).toBe(t('en', 'heroDek'));
    expect(doc.querySelector('main')!.text.split(summary)).toHaveLength(2);
  });

  it('renders filter chips only for categories present, plus All', async () => {
    const chips = (d: HTMLElement) => d.querySelectorAll('button[data-filter]').map((b) => b.getAttribute('data-filter'));
    expect(chips((await renderPath('en', '2026-09')).doc)).toEqual(['all', 'Schemes', 'Environment', 'Culture', 'Youth']);
    expect(chips((await renderPath('en', '2026-08')).doc)).toEqual(['all', 'Environment', 'Culture', 'Health']);
    const cards = (await renderPath('en', '2026-09')).doc.querySelectorAll('[data-category]');
    expect(cards).toHaveLength(4);
  });

  it('omits People, Places and Stats sections when empty', async () => {
    const full = (await renderPath('en', '2026-09')).doc;
    expect(full.querySelector('#people')).not.toBeNull();
    expect(full.querySelector('#map')).not.toBeNull();
    expect(full.querySelector('.numbers')).not.toBeNull();
    const empty = (await renderPath('en', '2026-08')).doc;
    expect(empty.querySelector('#people')).toBeNull();
    expect(empty.querySelector('#map')).toBeNull();
    expect(empty.querySelector('.numbers')).toBeNull();
    expect(empty.querySelector('#schemes')).toBeNull();
    expect(empty.text).not.toContain(t('en', 'peopleTitle'));
  });

  it('renders a full scheme card with apply link, helpline and checked date', async () => {
    const { doc } = await renderPath('en', '2026-09');
    const card = doc.querySelector('[data-scheme="pm-kisan"]')!;
    expect(card.getAttribute('id')).toBe('scheme-pm-kisan');
    const toggle = card.querySelector('button[aria-expanded]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(card.text).toContain('Who can apply');
    expect(card.text).toContain('Complete eKYC.');
    expect(card.text).toContain('Land records');
    const apply = card.querySelector('a.apply')!;
    expect(apply.getAttribute('href')).toBe('https://pmkisan.gov.in/');
    expect(apply.getAttribute('rel')).toContain('noopener');
    expect(squash(card.text)).toContain('155261');
    expect(squash(card.text)).toContain('Checked against official portal 20 October 2026');
  });

  it('renders a mention-only scheme as name, one line and official link, without Who can apply', async () => {
    const ep: Episode = structuredClone(eps().find((e) => e.date.startsWith('2026-09'))!);
    ep.topics[1].schemeIds = ['sample-mention'];
    const { doc } = await renderProps({ episode: ep, schemes: schemes(), lang: 'en' }, { month: '2026-09' });
    const card = doc.querySelector('[data-scheme="sample-mention"]')!;
    expect(card.text).toContain('Sample Scheme (fictional)');
    expect(card.text).toContain('A fictional scheme used to test mention-only display.');
    expect(card.querySelector('a[href="https://www.india.gov.in/"]')).not.toBeNull();
    expect(card.text).not.toContain('Who can apply');
    expect(card.querySelector('button[aria-expanded]')).toBeNull();
  });

  it('links topics with schemes to their scheme cards', async () => {
    const { doc } = await renderPath('en', '2026-09');
    const topic = doc.querySelector('[data-topic="millet-sharing"]')!;
    expect(topic.querySelector('a[href="#scheme-pm-kisan"]')).not.toBeNull();
    expect(topic.text).toContain('Farmers share one storage shed.');
  });

  it('has the exact footer disclaimer and official source links', async () => {
    const { doc } = await renderPath('en', '2026-09');
    const footer = doc.querySelector('footer')!;
    expect(squash(footer.text)).toContain(t('en', 'footerDisclaimer'));
    const hrefs = footer.querySelectorAll('a').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['https://www.pib.gov.in/', 'https://www.pmindia.gov.in/', 'https://www.myscheme.gov.in/']));
  });

  it('quote has a figcaption with the paragraph number and an official link', async () => {
    const { doc } = await renderPath('en', '2026-09');
    const fig = doc.querySelector('figure.quote')!;
    expect(fig.querySelector('blockquote')!.text).toContain(
      'farmers have started growing millets together and sharing one storage shed',
    );
    const cap = fig.querySelector('figcaption')!;
    expect(squash(cap.text)).toContain('paragraph 2');
    expect(cap.querySelector('a[href="https://www.pmindia.gov.in/en/sample-2026-09"]')).not.toBeNull();
  });

  it('links to previous and next episodes when they exist', async () => {
    const sep = (await renderPath('en', '2026-09')).doc;
    expect(sep.querySelector('a[rel="prev"]')!.getAttribute('href')).toBe('/mann-ki-baat/2026-08/');
    expect(sep.querySelector('a[rel="next"]')).toBeNull();
    const aug = (await renderPath('en', '2026-08')).doc;
    expect(aug.querySelector('a[rel="next"]')!.getAttribute('href')).toBe('/mann-ki-baat/2026-09/');
  });

  it('language switch links to other languages of the same month and lists complete machine langs', async () => {
    const { doc } = await renderPath('en', '2026-09');
    const sw = doc.querySelector('.lang-switch')!;
    const hrefs = sw.querySelectorAll('a[hreflang]').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/mann-ki-baat/2026-09/', '/mann-ki-baat/hi/2026-09/', '/mann-ki-baat/kn/2026-09/']));
    expect(hrefs).not.toContain('/mann-ki-baat/ta/2026-09/');
    expect(sw.querySelector('details')!.text).toContain('ಕನ್ನಡ');
    expect(sw.querySelector('details')!.text).toContain(t('en', 'translateGuide'));
  });

  it('carries the client-script hooks', async () => {
    const { doc } = await renderPath('en', '2026-09');
    expect(doc.querySelector('#scheme-search')).not.toBeNull();
    expect(doc.querySelectorAll('button[data-audience]').map((b) => b.getAttribute('data-audience'))).toEqual(['farmers']);
    expect(doc.querySelectorAll('[data-countup]').length).toBeGreaterThanOrEqual(4);
  });
});

describe('episode page — hi', () => {
  it('shows the episode number and the hi headline', async () => {
    const { doc } = await renderPath('hi', '2026-09');
    expect(doc.querySelector('html')!.getAttribute('lang')).toBe('hi');
    expect(doc.querySelector('h1')!.text).toContain('नमूना एपिसोड: साथ मिलकर आगे');
    expect(doc.querySelector('.dateline')!.text).toContain('138');
    expect(doc.querySelector('.machine-notice')).toBeNull();
    expect(squash(doc.querySelector('footer')!.text)).toContain(t('hi', 'footerDisclaimer'));
  });
});

describe('episode page — kn (machine language)', () => {
  it('sets <html lang="kn"> and loads the Kannada fonts', async () => {
    const { doc, html } = await renderPath('kn', '2026-09');
    expect(doc.querySelector('html')!.getAttribute('lang')).toBe('kn');
    // The fonts stylesheet is injected after load (Lighthouse) and linked in <noscript>; the URL is in the HTML either way.
    const href = html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"'<\s]+/)?.[0] ?? '';
    expect(href).toContain('Baloo+Tamma+2');
    expect(href).toContain('Noto+Sans+Kannada');
  });

  it('shows the exact machine-translate notice near the top', async () => {
    const { html, doc } = await renderPath('kn', '2026-09');
    const notice = doc.querySelector('.machine-notice')!;
    expect(squash(notice.text)).toContain(t('kn', 'machineNotice'));
    expect(html.indexOf('machine-notice')).toBeLessThan(html.indexOf('id="glance"'));
  });

  it('shows the Hindi original with the Kannada translation beneath, labelled', async () => {
    const { doc } = await renderPath('kn', '2026-09');
    const fig = doc.querySelector('figure.quote')!;
    const bq = fig.querySelector('blockquote')!;
    expect(bq.getAttribute('lang')).toBe('hi');
    expect(bq.text).toContain('किसानों ने मिलकर मोटा अनाज उगाना शुरू किया है और एक ही भंडार साझा करते हैं');
    const tr = fig.querySelector('.translation')!;
    expect(tr.text).toContain('ರೈತರು ಒಟ್ಟಿಗೆ ರಾಗಿ ಬೆಳೆಯಲು ಪ್ರಾರಂಭಿಸಿದ್ದಾರೆ');
    expect(tr.text).toContain(t('kn', 'quoteTranslation'));
    const html = fig.toString();
    expect(html.indexOf('<blockquote')).toBeLessThan(html.indexOf('translation'));
    expect(squash(fig.querySelector('figcaption')!.text)).toContain(`${t('kn', 'quoteParagraph')} 3`);
  });

  it('marks schemes without Kannada as details in English', async () => {
    const { doc } = await renderPath('kn', '2026-09');
    const card = doc.querySelector('[data-scheme="pm-kisan"]')!;
    expect(card.text).toContain(t('kn', 'detailsInEnglish'));
    expect(card.text).toContain('PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)');
  });
});

describe('getStaticPaths', () => {
  it('en yields one path per episode', () => {
    expect(enPaths(eps(), schemes()).map((p) => p.params.month)).toEqual(['2026-09', '2026-08']);
  });
  it('[lang] yields complete non-en langs and omits partial ta', () => {
    const got = langPaths(eps(), schemes()).map((p) => `${p.params.lang}/${p.params.month}`);
    expect(got.sort()).toEqual(['hi/2026-08', 'hi/2026-09', 'kn/2026-09']);
  });
  it('route files export getStaticPaths', async () => {
    const en = (await import('../../src/pages/[month].astro')) as unknown as { getStaticPaths: unknown };
    const other = (await import('../../src/pages/[lang]/[month].astro')) as unknown as { getStaticPaths: unknown };
    expect(typeof en.getStaticPaths).toBe('function');
    expect(typeof other.getStaticPaths).toBe('function');
  });
});
