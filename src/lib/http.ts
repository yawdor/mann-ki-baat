export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
  /** Treat a 404 as final (no further attempts). Used when probing URLs that may not exist yet. */
  stopOn404?: boolean;
  /**
   * Only https://www.pmindia.gov.in may be fetched: the start URL is checked first and the final
   * URL (`res.url`, after redirects) again afterwards. Breaking either rule throws (never retried).
   */
  pmindiaOnly?: boolean;
};

/** Thrown for a URL or redirect outside the allowed host. Never retried. */
export class OffHostError extends Error {}

export type RetryResult =
  | { ok: true; res: Response }
  | { ok: false; status?: number; error: string };

/**
 * GET with a browser-like User-Agent, redirects followed, per-attempt timeout and linear backoff.
 * Defaults: 3 attempts, 20 s timeout. On success the caller owns the response body.
 */
export async function fetchWithRetry(
  fetchFn: typeof fetch,
  url: string,
  { retries = 3, timeoutMs = 20_000, backoffMs = 1000, stopOn404 = false, pmindiaOnly = false }: RetryOptions = {},
): Promise<RetryResult> {
  if (pmindiaOnly && !isPmindiaUrl(url))
    throw new OffHostError(`refusing to fetch ${url}: only https://www.pmindia.gov.in is allowed`);
  let last = '';
  let status: number | undefined;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(url, {
        redirect: 'follow',
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      // A mocked Response has an empty url; a real one always carries the final URL.
      if (pmindiaOnly && res.url && !isPmindiaUrl(res.url)) {
        await res.body?.cancel().catch(() => {});
        throw new OffHostError(`${url} redirected off www.pmindia.gov.in to ${res.url}`);
      }
      if (res.ok) return { ok: true, res };
      await res.body?.cancel().catch(() => {});
      status = res.status;
      last = `HTTP ${res.status}`;
      if (stopOn404 && res.status === 404) break;
    } catch (e) {
      if (e instanceof OffHostError) throw e;
      status = undefined;
      last = e instanceof Error ? e.message : String(e);
    }
    if (attempt < retries && backoffMs > 0)
      await new Promise((r) => setTimeout(r, backoffMs * attempt));
  }
  return { ok: false, status, error: last };
}

/** Only https://www.pmindia.gov.in is ever fetched by the pipeline. */
export function isPmindiaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'www.pmindia.gov.in';
  } catch {
    return false;
  }
}
