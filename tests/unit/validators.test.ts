import { describe, expect, test, vi } from 'vitest';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { quotes } from '../../validators/checks/quotes';
import { sources } from '../../validators/checks/sources';
import { makeLinksCheck } from '../../validators/checks/links';
import { languages, machineLanguages } from '../../validators/checks/languages';
import { noGuessing } from '../../validators/checks/noGuessing';
import { sanity, lastSunday } from '../../validators/checks/sanity';
import { runContentValidation } from '../../validators/run';
import { completeLangs } from '../../src/lib/langs';
import { applyBroken, ctxFor, makeRoot, loadFx } from './helpers/content';
import type { Check } from '../../validators/types';

/** Runs `check` on a broken fixture and asserts it fails with a message naming the field. */
async function fails(check: Check, name: string) {
  const { spec } = applyBroken(name);
  const r = await check(ctxFor(name));
  expect(r.ok, `${name} should fail`).toBe(false);
  expect(r.messages.join('\n')).toContain(spec.expect);
}

const quick = makeLinksCheck({ backoffMs: 0, timeoutMs: 50 });
const res = (status: number) => new Response(null, { status });

describe('valid fixture passes every check', () => {
  test.each([
    ['quotes', quotes],
    ['sources', sources],
    ['languages', languages],
    ['noGuessing', noGuessing],
    ['sanity', sanity],
    ['links', quick],
  ] as const)('%s', async (_n, check) => {
    const r = await check(ctxFor());
    expect(r.messages).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe('schema', () => {
  test('missing title.hi is reported and blocks the run', async () => {
    const { raw, spec } = applyBroken('schema-missing-title-hi');
    const report = await runContentValidation('2026-09', { root: makeRoot({ episode: raw }) });
    expect(report.ok).toBe(false);
    const r = report.results.find((x) => x.check === 'schema')!;
    expect(r.ok).toBe(false);
    expect(r.messages.join('\n')).toContain(spec.expect);
  });
  test('full scheme without checkedAt fails schema too', async () => {
    const { raw } = applyBroken('noguessing-no-checkedat');
    const report = await runContentValidation('2026-09', { root: makeRoot({ scheme: ['pm-kisan', raw] }) });
    expect(report.ok).toBe(false);
    expect(report.results.find((x) => x.check === 'schema')!.messages.join()).toContain('checkedAt');
  });
});

describe('quotes', () => {
  test.each(['quote-en-mismatch', 'quote-hi-mismatch', 'quote-para-out-of-range'])('%s', (n) =>
    fails(quotes, n),
  );
  test('quotes passes when transcript has curly quotes and quote has straight', async () => {
    const ctx = ctxFor();
    ctx.paras.en[1] = ctx.paras.en[1].replace(
      'growing millets together',
      '“growing millets” – together',
    );
    ctx.episode.topics[0].quote!.text.en = 'farmers have started "growing millets" - together and sharing one storage shed';
    const r = await quotes(ctx);
    expect(r.messages).toEqual([]);
  });
});

describe('sources', () => {
  test.each(['source-not-official', 'source-para-out-of-range'])('%s', (n) => fails(sources, n));
  test('sources rejects https://example.com', async () => {
    const ctx = ctxFor();
    ctx.episode.sources.en = 'https://example.com';
    const r = await sources(ctx);
    expect(r.ok).toBe(false);
    expect(r.messages.join()).toContain('sources.en');
  });
  test('sources accepts https://pmkisan.gov.in/x', async () => {
    const ctx = ctxFor();
    ctx.episode.topics[0].facts[0].source = { url: 'https://pmkisan.gov.in/x' };
    expect((await sources(ctx)).ok).toBe(true);
  });
});

describe('links', () => {
  test('links retries 3 times then fails', async () => {
    const fetch = vi.fn(async () => res(429));
    const r = await quick(ctxFor(undefined, { fetch: fetch as unknown as typeof globalThis.fetch }));
    expect(r.ok).toBe(false);
    expect(r.messages[0]).toContain('HTTP 429');
    const urls = new Set(fetch.mock.calls.map((c) => (c as unknown[])[0]));
    expect(fetch.mock.calls.length).toBe(urls.size * 3);
  });
  test('links passes on 403 then 200', async () => {
    const seen = new Map<string, number>();
    const fetch = vi.fn(async (u: string) => {
      const n = (seen.get(u) ?? 0) + 1;
      seen.set(u, n);
      return res(n === 1 ? 403 : 200);
    });
    const r = await quick(ctxFor(undefined, { fetch: fetch as unknown as typeof globalThis.fetch }));
    expect(r.messages).toEqual([]);
    expect(r.ok).toBe(true);
  });
  test('links accepts 301→200 (redirect followed, final response ok)', async () => {
    const fetch = vi.fn(async (_u: string, init?: RequestInit) => {
      expect(init?.redirect).toBe('follow');
      expect((init?.headers as Record<string, string>)['User-Agent']).toMatch(/Chrome\//);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return res(200);
    });
    expect((await quick(ctxFor(undefined, { fetch: fetch as unknown as typeof globalThis.fetch }))).ok).toBe(true);
  });
  test('network errors count as failures', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const r = await quick(ctxFor(undefined, { fetch: fetch as unknown as typeof globalThis.fetch }));
    expect(r.ok).toBe(false);
    expect(r.messages[0]).toContain('fetch failed');
  });
  test('timeout aborts a hanging request', async () => {
    const fetch = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_r, rej) =>
          init!.signal!.addEventListener('abort', () => rej(new Error('aborted'))),
        ),
    );
    const r = await makeLinksCheck({ backoffMs: 0, timeoutMs: 5, retries: 2 })(
      ctxFor(undefined, { fetch: fetch as unknown as typeof globalThis.fetch }),
    );
    expect(r.ok).toBe(false);
    expect(r.messages[0]).toContain('after 2 attempts');
  });
});

describe('languages', () => {
  test('languages: empty hi on one topic gives an error', async () => {
    await fails(languages, 'language-empty-hi');
    expect((await languages(ctxFor('language-empty-hi'))).level).toBe('error');
  });
  test('hi that is not Devanagari is an error', () => fails(languages, 'language-hi-not-devanagari'));
  test('languages: partial kn gives a warning, ok stays true, and completeLangs excludes kn', async () => {
    const ctx = ctxFor('language-kn-partial');
    expect((await languages(ctx)).ok).toBe(true);
    const w = await machineLanguages(ctx);
    expect(w.level).toBe('warning');
    expect(w.ok).toBe(false);
    expect(w.messages.join()).toContain('topics[0].title.kn');
    expect(completeLangs(ctx.episode, ctx.schemes)).toEqual(['en', 'hi']);

    const { raw } = applyBroken('language-kn-partial');
    const report = await runContentValidation('2026-09', { root: makeRoot({ episode: raw }), fetch: ctx.fetch });
    expect(report.ok).toBe(true);
    expect(report.completeLangs).toEqual(['en', 'hi']);
    expect(report.warnings).toBeGreaterThan(0);
  });
  test('2026-09 fixture: ta is incomplete (river-cleanup), kn is complete', () => {
    const ctx = ctxFor();
    expect(completeLangs(ctx.episode, ctx.schemes)).toEqual(['en', 'hi', 'kn']);
  });
});

describe('noGuessing', () => {
  test.each(['noguessing-no-checkedat', 'noguessing-no-steps'])('%s', (n) => fails(noGuessing, n));
});

describe('sanity', () => {
  test.each([
    'sanity-too-few-topics',
    'sanity-episode-number',
    'sanity-date-outside-month',
    'sanity-unknown-person',
    'sanity-unknown-scheme',
    'sanity-duplicate-topic-id',
  ])('%s', (n) => fails(sanity, n));

  test('sanity warns (not errors) when date is not last Sunday', async () => {
    const r = await lastSunday(ctxFor('sanity-not-last-sunday'));
    expect(r.level).toBe('warning');
    expect(r.ok).toBe(false);
    expect(r.messages.join()).toContain('last Sunday');
    expect((await sanity(ctxFor('sanity-not-last-sunday'))).ok).toBe(true);

    // The date comes from the saved page, so meta.json carries the same (non-last-Sunday) date.
    const { raw } = applyBroken('sanity-not-last-sunday');
    const root = makeRoot({ episode: raw, meta: { date: raw.date } });
    const report = await runContentValidation('2026-09', { root, fetch: ctxFor().fetch });
    expect(report.ok).toBe(true);
  });
  test('last Sunday of 2026-09 is accepted', async () => {
    expect((await lastSunday(ctxFor())).ok).toBe(true);
  });
});

describe('runContentValidation', () => {
  test('runContentValidation ok on valid fixture', async () => {
    const fetch = vi.fn(async () => res(200)) as unknown as typeof globalThis.fetch;
    const report = await runContentValidation('2026-09', { root: makeRoot(), fetch });
    const failing = report.results.filter((r) => !r.ok && r.level === 'error');
    expect(failing).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.completeLangs).toEqual(['en', 'hi', 'kn']);
    expect(report.results.map((r) => r.check)).toEqual(
      expect.arrayContaining(['schema', 'quotes', 'sources', 'links', 'languages', 'noGuessing', 'sanity']),
    );
  });
  test('uses the previous episode: equal episode number fails sanity', async () => {
    const ep = loadFx('episodes/2026-09');
    ep.episode = 137;
    const report = await runContentValidation('2026-09', { root: makeRoot({ episode: ep }), fetch: ctxFor().fetch });
    expect(report.ok).toBe(false);
    expect(report.results.find((r) => r.check === 'sanity')!.messages.join()).toContain('previous episode 137');
  });
  test('missing episode file is a clean failure', async () => {
    const report = await runContentValidation('2027-01', { root: makeRoot(), fetch: ctxFor().fetch });
    expect(report.ok).toBe(false);
    expect(report.results[0].check).toBe('load');
  });
});

describe('fix round 1', () => {
  test('parseArgs handles month with and without --root', async () => {
    const { parseArgs } = await import('../../validators/args');
    const { resolve } = await import('node:path');
    expect(parseArgs(['2026-10'])).toEqual({ month: '2026-10', root: resolve('.') });
    expect(parseArgs(['2026-10', '--root', 'x'])).toEqual({ month: '2026-10', root: resolve('x') });
    expect(parseArgs(['--root', 'x', '2026-10']).month).toBe('2026-10');
    expect(parseArgs([]).month).toBeUndefined();
  });

  test('a check that throws becomes an error result, not a rejected run', async () => {
    const { CHECKS } = await import('../../validators/run');
    CHECKS.push((() => {
      throw new Error('boom');
    }) as Check);
    try {
      const report = await runContentValidation('2026-09', { root: makeRoot(), fetch: ctxFor().fetch });
      expect(report.ok).toBe(false);
      expect(report.results.some((r) => r.messages.join().includes('threw: boom'))).toBe(true);
    } finally {
      CHECKS.pop();
    }
  });

  test('malformed previous episode JSON is an error result', async () => {
    const root = makeRoot();
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${root}/content/episodes/2026-08.json`, '{ not json');
    const report = await runContentValidation('2026-09', { root, fetch: ctxFor().fetch });
    expect(report.ok).toBe(false);
    expect(report.results.find((r) => r.check === 'previous')!.messages.join()).toContain('2026-08');
  });

  test('previous episode failing the schema is an error result', async () => {
    const root = makeRoot();
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${root}/content/episodes/2026-08.json`, JSON.stringify({ episode: 137 }));
    const report = await runContentValidation('2026-09', { root, fetch: ctxFor().fetch });
    expect(report.ok).toBe(false);
    expect(report.results.find((r) => r.check === 'previous')!.messages.join()).toContain('schema');
  });

  test('empty machine-language string parses and is reported incomplete', async () => {
    const raw = loadFx('episodes/2026-09');
    raw.topics[0].title.kn = '';
    const { EpisodeSchema } = await import('../../src/lib/schema');
    expect(EpisodeSchema.safeParse(raw).success).toBe(true);
    const report = await runContentValidation('2026-09', { root: makeRoot({ episode: raw }), fetch: ctxFor().fetch });
    expect(report.ok).toBe(true);
    expect(report.completeLangs).toEqual(['en', 'hi']);
    expect(report.results.find((r) => r.check === 'languages.machine')!.messages.join()).toContain('topics[0].title.kn');
    raw.topics[0].title.hi = '';
    expect(EpisodeSchema.safeParse(raw).success).toBe(false);
  });
});

describe('scheme file names and ids (schema check)', () => {
  test('schemaCheck rejects a file whose name is not <id>.json', async () => {
    const { schemaCheck } = await import('../../validators/checks/schema');
    const r = schemaCheck(loadFx('episodes/2026-09'), new Map([['kisan.json', loadFx('schemes/pm-kisan')]]));
    expect(r.ok).toBe(false);
    expect(r.messages.join()).toContain('scheme kisan.json: file must be named pm-kisan.json');
  });

  test('runContentValidation errors on a misnamed duplicate scheme file', async () => {
    const root = makeRoot({ scheme: ['pm-kisan-copy', loadFx('schemes/pm-kisan')] });
    const report = await runContentValidation('2026-09', { root, fetch: ctxFor().fetch });
    expect(report.ok).toBe(false);
    const msgs = report.results.find((r) => r.check === 'schema')!.messages.join('\n');
    expect(msgs).toContain('duplicate scheme id "pm-kisan" in pm-kisan-copy.json and pm-kisan.json');
    expect(msgs).toContain('scheme pm-kisan-copy.json: file must be named pm-kisan.json');
  });
});

describe('evidence', () => {
  const load = async () => (await import('../../validators/checks/evidence')).evidence;
  const ctxAt = (root: string, episode = ctxFor().episode) => ctxFor(undefined, { root, episode });
  const msgs = async (ctx: ReturnType<typeof ctxFor>) => {
    const r = await (await load())(ctx);
    expect(r.level).toBe('error');
    return r.messages.join('\n');
  };

  test('valid fixture passes', async () => {
    const r = await (await load())(ctxFor());
    expect(r.messages).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('episode number, date and source URLs must equal meta.json', async () => {
    const ep = structuredClone(ctxFor().episode);
    ep.episode = 140;
    ep.date = '2026-09-20';
    ep.sources.en = 'https://www.pmindia.gov.in/en/other';
    ep.sources.hi = 'https://www.pmindia.gov.in/hi/other';
    const m = await msgs(ctxAt(makeRoot(), ep));
    expect(m).toContain('episode 140 does not match sources/2026-09/meta.json episode 138');
    expect(m).toContain('date 2026-09-20 does not match sources/2026-09/meta.json date 2026-09-27');
    expect(m).toContain('sources.en https://www.pmindia.gov.in/en/other does not match meta.urls.en');
    expect(m).toContain('sources.hi https://www.pmindia.gov.in/hi/other does not match meta.urls.hi');
  });

  test('saved HTML whose sha256 differs from meta.json fails', async () => {
    const root = makeRoot();
    const p = join(root, 'sources', '2026-09', 'hi.html');
    writeFileSync(p, readFileSync(p, 'utf8').replace('</body>', '<!-- x --></body>'));
    expect(await msgs(ctxAt(root))).toContain('sources/2026-09/hi.html: sha256');
  });

  test('CRLF-converted HTML fails the hash check (bytes must be preserved)', async () => {
    const root = makeRoot();
    const p = join(root, 'sources', '2026-09', 'en.html');
    writeFileSync(p, readFileSync(p, 'utf8').replace(/\n/g, '\r\n'));
    expect(await msgs(ctxAt(root))).toContain('sources/2026-09/en.html: sha256');
  });

  test('paras.json that does not match a re-parse of the saved HTML fails', async () => {
    const root = makeRoot();
    const p = join(root, 'sources', '2026-09', 'en.paras.json');
    const paras = JSON.parse(readFileSync(p, 'utf8'));
    paras[1] = 'An invented paragraph.';
    writeFileSync(p, JSON.stringify(paras));
    const m = await msgs(ctxAt(root));
    expect(m).toContain('sources/2026-09/en.paras.json does not match the paragraphs parsed from en.html');
    expect(m).toContain('first difference at paragraph 2');
  });

  test('missing meta.json or HTML is an error', async () => {
    const root = makeRoot();
    rmSync(join(root, 'sources', '2026-09', 'meta.json'));
    expect(await msgs(ctxAt(root))).toContain('sources/2026-09/meta.json');
    const root2 = makeRoot();
    rmSync(join(root2, 'sources', '2026-09', 'en.html'));
    expect(await msgs(ctxAt(root2))).toContain('sources/2026-09/en.html');
  });

  test('runContentValidation runs evidence as an error-level check', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'sources', '2026-09', 'en.html'), 'tampered');
    const report = await runContentValidation('2026-09', { root, fetch: ctxFor().fetch });
    expect(report.ok).toBe(false);
    expect(report.results.find((r) => r.check === 'evidence')).toMatchObject({ ok: false, level: 'error' });
  });
});
