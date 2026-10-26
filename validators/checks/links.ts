import { allSources } from './sources';
import { isOfficialUrl } from '../../src/lib/schema';
import { fetchWithRetry } from '../../src/lib/http';
import { result, type Check, type ValidationContext } from '../types';

export function distinctOfficialUrls(ctx: ValidationContext): string[] {
  const urls = new Set<string>([ctx.episode.sources.en, ctx.episode.sources.hi]);
  for (const s of ctx.schemes.values()) {
    urls.add(s.officialUrl);
    if (s.detailSource) urls.add(s.detailSource.url);
  }
  for (const { source } of allSources(ctx.episode)) if ('url' in source) urls.add(source.url);
  return [...urls].filter(isOfficialUrl);
}

export type LinksOptions = {
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
  concurrency?: number;
};

/** Defaults: 3 attempts, 20 s timeout each. Tests inject tiny backoff/timeouts. */
export function makeLinksCheck({
  retries = 3,
  timeoutMs = 20_000,
  backoffMs = 1000,
  concurrency = 6,
}: LinksOptions = {}): Check {
  return async (ctx) => {
    const urls = distinctOfficialUrls(ctx);
    const messages: string[] = [];
    const probe = async (url: string): Promise<string | null> => {
      const r = await fetchWithRetry(ctx.fetch, url, { retries, timeoutMs, backoffMs });
      if (r.ok) {
        await r.res.body?.cancel().catch(() => {});
        return null;
      }
      const last = r.error;
      return `${url}: ${last} after ${retries} attempts`;
    };
    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const m = await probe(urls[next++]);
        if (m) messages.push(m);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
    return result('links', 'error', messages.sort());
  };
}

export const links: Check = makeLinksCheck();
