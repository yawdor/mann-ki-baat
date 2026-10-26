import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, test, vi } from 'vitest';
import { shouldRun, targetMonth } from '../../pipeline/window';
import { extractParagraphs, parseTranscript } from '../../pipeline/paras';
import { discoverEpisode, enUrl, hiUrl, ordinal, HI_LISTING, EN_LISTING } from '../../pipeline/discover';
import { saveSources } from '../../pipeline/fetch';
import { publish } from '../../pipeline/publish';
import { fetchWithRetry } from '../../src/lib/http';
import type { ContentReport } from '../../validators/run';

const fx = (name: string) => readFileSync(join('tests/fixtures/transcripts', `${name}.html`), 'utf8');
const tmp = () => mkdtempSync(join(tmpdir(), 'mkb-pipeline-'));
const RETRY = { backoffMs: 0, timeoutMs: 1000 };

/** Mocked fetch serving a url -> html map; anything else is a 404. */
function mockFetch(pages: Record<string, string>) {
  return vi.fn(async (url: string | URL | Request) => {
    const body = pages[String(url)];
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(body, { status: 200 });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const listing = (...ns: number[]) =>
  `<html><body>${ns
    .map(
      (n) =>
        `<a href="${enUrl(n)}?tag_term=mann-ki-baat&comment=disable" title="PM's address in the ${ordinal(n)} Episode of Mann Ki Baat">x</a>`,
    )
    .join('')}</body></html>`;

describe('targetMonth (IST)', () => {
  test.each([
    ['2026-10-26T06:00:00Z', '2026-10'],
    ['2026-10-31T06:00:00Z', '2026-10'],
    ['2027-01-02T06:00:00Z', '2026-12'],
    ['2026-11-04T06:00:00Z', '2026-10'],
    ['2026-11-05T06:00:00Z', null],
    ['2026-10-15T06:00:00Z', null],
    ['2026-10-25T20:00:00Z', '2026-10'], // already 26 Oct 01:30 IST
    ['2026-10-25T18:29:00Z', null], // still 25 Oct 23:59 IST
    ['2026-10-31T19:00:00Z', '2026-10'], // 1 Nov 00:30 IST
    ['2026-11-04T18:29:00Z', '2026-10'], // 4 Nov 23:59 IST
  ])('%s -> %s', (iso, want) => {
    expect(targetMonth(new Date(iso))).toBe(want);
  });
});

describe('shouldRun', () => {
  test('false when the month file exists, true when it does not', () => {
    const root = tmp();
    const now = new Date('2026-10-26T06:00:00Z');
    expect(shouldRun(now, root)).toMatchObject({ run: true, month: '2026-10' });
    mkdirSync(join(root, 'content', 'episodes'), { recursive: true });
    writeFileSync(join(root, 'content', 'episodes', '2026-10.json'), '{}');
    const r = shouldRun(now, root);
    expect(r).toMatchObject({ run: false, month: '2026-10' });
    expect(r.reason).toContain('already exists');
  });
  test('false outside the window', () => {
    expect(shouldRun(new Date('2026-10-15T06:00:00Z'), tmp())).toMatchObject({ run: false, month: null });
  });
});

describe('transcript parsing (real saved pages)', () => {
  // Counted by hand: raw `<p` openers between `<div class='news-bg'>` and `<div class="tweet-container"`
  // (grep -o "<p[ >]" over that line range), minus paragraphs that are empty after stripping tags
  // and &nbsp; (the stray DOCTYPE/<html><body> first <p> in hi, plus blank spacer paragraphs).
  // en-138 68, en-139 69, hi-138 67-3=64, hi-139 53-2=51. The iframe <p> is outside news-bg.
  // The Hindi pages also end with a staff-initials line ("MJPS/SS/ST/VK"), which is dropped: hi 63 and 50.
  // Research's HI-138 figure of 68 counted the first tweet's <p lang=...>, which shares the line holding
  // <div class="tweet-container">; excluding it gives 67 raw openers.
  test.each([
    ['en-138', 68, 138, '2026-09-27'],
    ['en-139', 69, 139, '2026-10-25'],
    ['hi-138', 63, 138, '2026-09-27'],
    ['hi-139', 50, 139, '2026-10-25'],
  ])('%s has %i paragraphs, episode %i, date %s', (name, count, episode, date) => {
    const html = fx(name);
    expect(extractParagraphs(html, 'div.news-bg > p')).toHaveLength(count);
    const t = parseTranscript(html);
    expect(t.paragraphs).toHaveLength(count);
    expect(t.episode).toBe(episode);
    expect(t.date).toBe(date);
  });

  test('clean text: no tweets, iframe, ">>>" or doctype junk; entities decoded; order kept', () => {
    const { paragraphs } = parseTranscript(fx('en-139'));
    expect(paragraphs[0]).toBe('My dear countrymen,');
    expect(paragraphs.at(-1)).toBe('Namaskar.');
    expect(paragraphs.every((p) => p !== '' && p !== '>>>' && !/DOCTYPE|<|&lsquo;|&rsquo;/.test(p))).toBe(true);
    expect(paragraphs.join('\n')).not.toContain('Join LIVE');
    expect(paragraphs[1]).toContain('Welcome once again to ‘Mann Ki Baat’.');
    expect(paragraphs.every((p) => !/\s{2}|^\s|\s$/.test(p))).toBe(true);
  });

  test('synthetic: drops empty, >>> and iframe paragraphs and tweet paragraphs', () => {
    const html = `<div class="content-block"><h2>The 5th Episode</h2></div><div class='news-bg'><p>&gt;&gt;&gt;</p><p> </p><p><iframe src="x">v</iframe></p><p>A  b\n c</p><p>Second</p></div><div class="tweet-container"><p>tweet</p></div>`;
    expect(extractParagraphs(html, 'div.news-bg > p')).toEqual(['A b c', 'Second']);
    expect(parseTranscript(html).episode).toBe(5);
    expect(parseTranscript(html).date).toBeNull();
  });
});

describe('url helpers', () => {
  test.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [101, '101st'], [111, '111th'], [131, '131st'], [138, '138th'], [139, '139th'],
  ])('ordinal(%i) = %s', (n, want) => expect(ordinal(n)).toBe(want));

  test('enUrl and hiUrl match the known D3 patterns', () => {
    expect(enUrl(139)).toBe('https://www.pmindia.gov.in/en/news_updates/pms-address-in-the-139th-episode-of-mann-ki-baat/');
    expect(hiUrl(139)).toBe(
      'https://www.pmindia.gov.in/hi/news_updates/%e0%a4%ae%e0%a4%a8-%e0%a4%95%e0%a5%80-%e0%a4%ac%e0%a4%be%e0%a4%a4-%e0%a4%95%e0%a5%80-139%e0%a4%b5%e0%a5%80%e0%a4%82-%e0%a4%95%e0%a5%9c%e0%a5%80-%e0%a4%ae%e0%a5%87%e0%a4%82-%e0%a4%aa%e0%a5%8d%e0%a4%b0/',
    );
  });
});

describe('discoverEpisode (mocked fetch)', () => {
  const base = {
    [enUrl(138)]: fx('en-138'),
    [hiUrl(138)]: fx('hi-138'),
  };

  test('listing lags: finds 139 by probing N+1 and derives the Hindi URL', async () => {
    const f = mockFetch({ ...base, [EN_LISTING]: listing(138, 137), [enUrl(139)]: fx('en-139'), [hiUrl(139)]: fx('hi-139') });
    const r = await discoverEpisode({ fetch: f, month: '2026-10', retry: RETRY });
    expect(r).toEqual({ episode: 139, date: '2026-10-25', urls: { en: enUrl(139), hi: hiUrl(139) } });
  });

  test('listing already shows 139 (no further probe needed beyond N+1/N)', async () => {
    const f = mockFetch({ ...base, [EN_LISTING]: listing(139, 138), [enUrl(139)]: fx('en-139'), [hiUrl(139)]: fx('hi-139') });
    expect((await discoverEpisode({ fetch: f, month: '2026-10', retry: RETRY }))?.episode).toBe(139);
  });

  test('picks the episode whose date is in the requested month', async () => {
    const f = mockFetch({ ...base, [EN_LISTING]: listing(138), [enUrl(139)]: fx('en-139'), [hiUrl(139)]: fx('hi-139') });
    const r = await discoverEpisode({ fetch: f, month: '2026-09', retry: RETRY });
    expect(r).toMatchObject({ episode: 138, date: '2026-09-27', urls: { en: enUrl(138), hi: hiUrl(138) } });
  });

  test('null when no episode is dated in the month (N+1 not published yet)', async () => {
    const f = mockFetch({ ...base, [EN_LISTING]: listing(138) });
    expect(await discoverEpisode({ fetch: f, month: '2026-10', retry: RETRY })).toBeNull();
    expect(await discoverEpisode({ fetch: f, month: '2026-11', retry: RETRY })).toBeNull();
  });

  test('falls back to the Hindi listing when the derived slug 404s', async () => {
    const odd = 'https://www.pmindia.gov.in/hi/news_updates/%e0%a4%ae%e0%a4%a8-139-other-slug/';
    const hiList = `<a href="${odd}?tag_term=mann-ki-baat" title="मन की बात की 139वीं कड़ी">x</a><a href="${hiUrl(138)}">138</a>`;
    const f = mockFetch({ [EN_LISTING]: listing(138), [enUrl(139)]: fx('en-139'), [HI_LISTING]: hiList, [odd]: fx('hi-139') });
    const r = await discoverEpisode({ fetch: f, month: '2026-10', retry: RETRY });
    expect(r?.urls.hi).toBe(odd);
  });

  test('errors when the Hindi page cannot be confirmed; errors when the listing is down', async () => {
    const f = mockFetch({ [EN_LISTING]: listing(138), [enUrl(139)]: fx('en-139') });
    await expect(discoverEpisode({ fetch: f, month: '2026-10', retry: RETRY })).rejects.toThrow(/Hindi page/);
    await expect(discoverEpisode({ fetch: mockFetch({}), month: '2026-10', retry: RETRY })).rejects.toThrow(/HTTP 404/);
  });

  test('a 404 probe is not retried', async () => {
    const f = mockFetch({ [EN_LISTING]: listing(138) });
    await discoverEpisode({ fetch: f, month: '2026-10', retry: { ...RETRY, retries: 3 } });
    const calls = f.mock.calls.map((c) => String(c[0]));
    expect(calls.filter((u) => u === enUrl(139))).toHaveLength(1);
  });
});

describe('saveSources (mocked fetch)', () => {
  test('writes html, paras and meta', async () => {
    const root = tmp();
    const urls = { en: enUrl(139), hi: hiUrl(139) };
    const f = mockFetch({ [urls.en]: fx('en-139'), [urls.hi]: fx('hi-139') });
    await saveSources('2026-10', urls, { root, fetch: f, retry: RETRY });
    const dir = join(root, 'sources', '2026-10');
    const paras = (l: string) => JSON.parse(readFileSync(join(dir, `${l}.paras.json`), 'utf8'));
    expect(paras('en')).toHaveLength(69);
    expect(paras('hi')).toHaveLength(50);
    expect(readFileSync(join(dir, 'en.html'), 'utf8')).toBe(fx('en-139'));
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
    expect(meta.urls).toEqual(urls);
    expect(meta.episode).toBe(139);
    expect(meta.date).toBe('2026-10-25');
    expect(new Date(meta.fetchedAt).toISOString()).toBe(meta.fetchedAt);
    expect(meta.sha256.en).toBe(createHash('sha256').update(fx('en-139'), 'utf8').digest('hex'));
    expect(meta.sha256.hi).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync(join(dir, 'hi.html'))).toBe(true);
  });

  test('throws (writing nothing) when a page fails or has no transcript', async () => {
    const root = tmp();
    const urls = { en: enUrl(139), hi: hiUrl(139) };
    await expect(
      saveSources('2026-10', urls, { root, fetch: mockFetch({ [urls.en]: fx('en-139') }), retry: { ...RETRY, retries: 2 } }),
    ).rejects.toThrow(/HTTP 404/);
    await expect(
      saveSources('2026-10', urls, { root, fetch: mockFetch({ [urls.en]: '<p>x</p>', [urls.hi]: fx('hi-139') }), retry: RETRY }),
    ).rejects.toThrow(/no transcript/);
    expect(existsSync(join(root, 'sources'))).toBe(false);
  });
});

describe('fetchWithRetry', () => {
  test('retries then succeeds, sending a browser UA and following redirects', async () => {
    let n = 0;
    const f = vi.fn(async () => (++n < 3 ? new Response(null, { status: 503 }) : new Response('ok'))) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    const r = await fetchWithRetry(f, 'https://x.gov.in/', { retries: 3, backoffMs: 0 });
    expect(r.ok).toBe(true);
    expect(f.mock.calls).toHaveLength(3);
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe('follow');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^Mozilla\/5\.0/);
  });
  test('reports the last error after exhausting attempts', async () => {
    const f = vi.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    const r = await fetchWithRetry(f, 'https://x.gov.in/', { retries: 2, backoffMs: 0 });
    expect(r).toEqual({ ok: false, status: undefined, error: 'fetch failed' });
    expect(f.mock.calls).toHaveLength(2);
  });
});

describe('publish (dry run only)', () => {
  const report = (ok: boolean): ContentReport => ({ month: '2026-10', ok, completeLangs: [], warnings: 0, results: [] });
  const trailer = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
  const IDENTITY = ['-c', 'user.name=Mann Ki Baat Routine', '-c', 'user.email=yawdor@users.noreply.github.com'];

  test('failing report -> drafts/<month> branch, report force-added, returns to original branch', async () => {
    const root = tmp();
    const r = await publish('2026-10', report(false), { root, dryRun: true });
    expect(r.branch).toBe('drafts/2026-10');
    const argv = r.commands.map((c) => c.join(' '));
    expect(argv[0]).toBe('git checkout -B drafts/2026-10');
    expect(argv).toContain('git add -f reports/2026-10.content.json');
    expect(argv).toContain('git push --force-with-lease -u origin drafts/2026-10');
    expect(argv.some((a) => a.startsWith(`git ${IDENTITY.join(' ')} commit`) && a.endsWith('-- reports/2026-10.content.json'))).toBe(true);
    // Every commit carries the routine's identity, so no git config is needed.
    expect(argv.filter((a) => / commit /.test(a)).every((a) => a.startsWith(`git ${IDENTITY.join(' ')} commit `))).toBe(true);
    expect(argv.at(-1)).toBe('git checkout <original-branch>');
    expect(argv.some((a) => a.includes('HEAD:main'))).toBe(false);
    expect(r.commands.every((c) => c[0] === 'git')).toBe(true);
    expect(existsSync(join(root, 'reports'))).toBe(false); // dry run writes nothing
  });

  test('passing report -> main, commit message with month label, episode and trailer', async () => {
    const root = tmp();
    mkdirSync(join(root, 'content', 'episodes'), { recursive: true });
    writeFileSync(join(root, 'content', 'episodes', '2026-10.json'), JSON.stringify({ episode: 139 }));
    const r = await publish('2026-10', report(true), { root, dryRun: true });
    expect(r.branch).toBe('main');
    expect(r.commands[0]).toEqual(['git', 'add', 'content', 'sources']);
    expect(r.commands[1].slice(-3)).toEqual(['--', 'content', 'sources']);
    expect(r.commands[1].slice(0, 7)).toEqual(['git', ...IDENTITY, 'commit', '-m']);
    expect(r.commands[1][7]).toBe(`content: Mann Ki Baat October 2026 (episode 139)\n\n${trailer}`);
    expect(r.commands[2]).toEqual(['git', 'push', 'origin', 'HEAD:main']);
  });

  test('draft plan only adds paths that exist', async () => {
    const root = tmp();
    mkdirSync(join(root, 'content'), { recursive: true });
    const argv = (await publish('2026-10', report(false), { root, dryRun: true })).commands.map((c) => c.join(' '));
    expect(argv).toContain('git add content');
  });

  test('strict gate and validation: truthy ok, wrong month and bad month are refused', async () => {
    const root = tmp();
    const truthy = { ...report(false), ok: 'yes' } as unknown as ContentReport;
    expect((await publish('2026-10', truthy, { root, dryRun: true })).branch).toBe('drafts/2026-10');
    await expect(publish('2026-09', report(true), { root, dryRun: true })).rejects.toThrow(/not 2026-09/);
    await expect(publish('../x', { ...report(true), month: '../x' }, { root, dryRun: true })).rejects.toThrow(/valid month/);
  });
});

describe('guards', () => {
  test('saveSources rejects a bad month, foreign hosts, episode and date mismatches', async () => {
    const root = tmp();
    const urls = { en: enUrl(139), hi: hiUrl(139) };
    const f = mockFetch({ [urls.en]: fx('en-139'), [urls.hi]: fx('hi-139'), 'https://evil.example/x': fx('en-139') });
    await expect(saveSources('2026-13', urls, { root, fetch: f, retry: RETRY })).rejects.toThrow(/valid month/);
    await expect(saveSources('2026-10', { en: 'https://evil.example/x', hi: urls.hi }, { root, fetch: f, retry: RETRY })).rejects.toThrow(/only https:\/\/www\.pmindia/);
    expect(f).not.toHaveBeenCalled();
    await expect(saveSources('2026-09', urls, { root, fetch: f, retry: RETRY })).rejects.toThrow(/not in 2026-09/);
    const f2 = mockFetch({ [urls.en]: fx('en-139'), [urls.hi]: fx('hi-138') });
    await expect(saveSources('2026-10', urls, { root, fetch: f2, retry: RETRY })).rejects.toThrow(/episode mismatch/);
    expect(existsSync(join(root, 'sources'))).toBe(false);
  });

  test('Hindi listing fallback ignores off-site links', async () => {
    const evil = 'https://evil.example/hi/news_updates/139/';
    const f = mockFetch({ [EN_LISTING]: listing(138), [enUrl(139)]: fx('en-139'), [HI_LISTING]: `<a href="${evil}">139</a>`, [evil]: fx('hi-139') });
    await expect(discoverEpisode({ fetch: f, month: '2026-10', retry: RETRY })).rejects.toThrow(/Hindi page/);
    expect(f.mock.calls.map((c) => String(c[0]))).not.toContain(evil);
  });

  test('trailing staff-initials line is dropped', () => {
    const html = `<div class='news-bg'><p>Hello</p><p>MJPS/SS/VJ/VK</p></div>`;
    expect(extractParagraphs(html, 'div.news-bg > p')).toEqual(['Hello']);
  });
});
