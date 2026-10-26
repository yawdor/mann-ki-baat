import { parse } from 'node-html-parser';
import { fetchWithRetry, isPmindiaUrl, type RetryOptions } from '../src/lib/http';
import { parseTranscript } from './paras';

const BASE = 'https://www.pmindia.gov.in';
export const EN_LISTING = `${BASE}/en/tag/mann-ki-baat/`;
export const HI_LISTING = `${BASE}/hi/tag/mann-ki-baat/`;

export type Discovered = {
  episode: number;
  date: string;
  urls: { en: string; hi: string };
};

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export const enUrl = (n: number) =>
  `${BASE}/en/news_updates/pms-address-in-the-${ordinal(n)}-episode-of-mann-ki-baat/`;

/** Slug is `मन-की-बात-की-{N}वीं-कड़ी-में-प्र` (precomposed U+095C), percent-encoded in lowercase hex. */
export function hiUrl(n: number): string {
  const slug = `मन-की-बात-की-${n}वीं-कड़ी-में-प्र`;
  return `${BASE}/hi/news_updates/${encodeURIComponent(slug).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase())}/`;
}

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

async function getHtml(
  fetchFn: typeof fetch,
  url: string,
  retry: RetryOptions,
): Promise<string | null> {
  const r = await fetchWithRetry(fetchFn, url, { stopOn404: true, ...retry });
  return r.ok ? r.res.text() : null;
}

/** Newest episode number on the English listing (parsed from item titles / hrefs). */
function listingNewest(html: string): number | null {
  let best: number | null = null;
  for (const a of parse(html).querySelectorAll('a')) {
    const s = `${a.getAttribute('title') ?? ''} ${a.getAttribute('href') ?? ''}`;
    const m = /(\d+)(?:st|nd|rd|th)[ -]episode/i.exec(s);
    if (m) {
      const n = Number(m[1]);
      if (best === null || n > best) best = n;
    }
  }
  return best;
}

async function confirmHindi(
  fetchFn: typeof fetch,
  n: number,
  retry: RetryOptions,
): Promise<string | null> {
  const has = (html: string) => parseTranscript(html).episode === n;
  const derived = hiUrl(n);
  const direct = await getHtml(fetchFn, derived, retry);
  if (direct !== null && has(direct)) return derived;
  const listing = await getHtml(fetchFn, HI_LISTING, retry);
  if (listing === null) return null;
  const numRe = new RegExp(`(?<!\\d)${n}(?!\\d)`);
  for (const a of parse(listing).querySelectorAll('a')) {
    const href = a.getAttribute('href') ?? '';
    if (!/\/hi\/news_updates\//.test(href)) continue;
    if (!numRe.test(`${a.getAttribute('title') ?? ''} ${a.text} ${safeDecode(href)}`)) continue;
    const url = new URL(href, BASE);
    url.search = '';
    if (!isPmindiaUrl(url.toString())) continue;
    const html = await getHtml(fetchFn, url.toString(), retry);
    if (html !== null && has(html)) return url.toString();
  }
  return null;
}

export async function discoverEpisode(opts: {
  fetch: typeof fetch;
  month: string;
  retry?: RetryOptions;
}): Promise<Discovered | null> {
  const retry = opts.retry ?? {};
  const listing = await fetchWithRetry(opts.fetch, EN_LISTING, retry);
  if (!listing.ok) throw new Error(`${EN_LISTING}: ${listing.error}`);
  const newest = listingNewest(await listing.res.text());
  if (newest === null) throw new Error(`no episodes found on ${EN_LISTING}`);

  // The listing lags the article, so probe N+1 first, then N.
  for (const n of [newest + 1, newest]) {
    const url = enUrl(n);
    const html = await getHtml(opts.fetch, url, retry);
    if (html === null) continue;
    const page = parseTranscript(html);
    if (page.episode !== n || !page.date || !page.date.startsWith(opts.month)) continue;
    const hi = await confirmHindi(opts.fetch, n, retry);
    if (!hi) throw new Error(`Hindi page for episode ${n} could not be confirmed`);
    return { episode: n, date: page.date, urls: { en: url, hi } };
  }
  return null;
}
