import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MONTH_RE } from '../src/lib/schema';
import { fetchWithRetry, isPmindiaUrl, type RetryOptions } from '../src/lib/http';
import { parseTranscript } from './paras';

export type SourceMeta = {
  urls: { en: string; hi: string };
  fetchedAt: string;
  sha256: { en: string; hi: string };
  episode: number | null;
  date: string | null;
};

export async function fetchHtml(
  fetchFn: typeof fetch,
  url: string,
  retry: RetryOptions = {},
): Promise<string> {
  const r = await fetchWithRetry(fetchFn, url, retry);
  if (!r.ok) throw new Error(`${url}: ${r.error}`);
  return r.res.text();
}

export async function saveSources(
  month: string,
  urls: { en: string; hi: string },
  opts: { root: string; fetch?: typeof fetch; retry?: RetryOptions },
): Promise<SourceMeta> {
  if (!MONTH_RE.test(month)) throw new Error(`"${month}" is not a valid month (YYYY-MM)`);
  for (const u of [urls.en, urls.hi])
    if (!isPmindiaUrl(u)) throw new Error(`refusing to fetch ${u}: only https://www.pmindia.gov.in is allowed`);
  const f = opts.fetch ?? fetch;
  const [en, hi] = await Promise.all([
    fetchHtml(f, urls.en, opts.retry),
    fetchHtml(f, urls.hi, opts.retry),
  ]);
  const pEn = parseTranscript(en);
  const pHi = parseTranscript(hi);
  if (!pEn.paragraphs.length) throw new Error(`no transcript paragraphs found at ${urls.en}`);
  if (!pHi.paragraphs.length) throw new Error(`no transcript paragraphs found at ${urls.hi}`);
  if (pEn.episode !== pHi.episode)
    throw new Error(`episode mismatch: en page says ${pEn.episode}, hi page says ${pHi.episode}`);
  for (const [lang, p] of [['en', pEn], ['hi', pHi]] as const)
    if (!p.date || !p.date.startsWith(month))
      throw new Error(`${lang} page date ${p.date ?? '(none)'} is not in ${month}`);
  const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  const meta: SourceMeta = {
    urls,
    fetchedAt: new Date().toISOString(),
    sha256: { en: sha(en), hi: sha(hi) },
    episode: pEn.episode ?? pHi.episode,
    date: pEn.date ?? pHi.date,
  };
  const dir = join(opts.root, 'sources', month);
  mkdirSync(dir, { recursive: true });
  const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
  writeFileSync(join(dir, 'en.html'), en);
  writeFileSync(join(dir, 'hi.html'), hi);
  writeFileSync(join(dir, 'en.paras.json'), json(pEn.paragraphs));
  writeFileSync(join(dir, 'hi.paras.json'), json(pHi.paragraphs));
  writeFileSync(join(dir, 'meta.json'), json(meta));
  return meta;
}
