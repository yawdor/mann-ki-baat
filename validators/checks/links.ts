import { allSources } from './sources';
import { isOfficialUrl } from '../../src/lib/schema';
import { result, type Check, type ValidationContext } from '../types';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

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
      let last = '';
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await ctx.fetch(url, {
            redirect: 'follow',
            headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
            signal: AbortSignal.timeout(timeoutMs),
          });
          await res.body?.cancel().catch(() => {});
          if (res.ok) return null;
          last = `HTTP ${res.status}`;
        } catch (e) {
          last = e instanceof Error ? e.message : String(e);
        }
        if (attempt < retries && backoffMs > 0)
          await new Promise((r) => setTimeout(r, backoffMs * attempt));
      }
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
