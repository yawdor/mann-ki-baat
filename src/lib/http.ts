export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
  /** Treat a 404 as final (no further attempts). Used when probing URLs that may not exist yet. */
  stopOn404?: boolean;
};

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
  { retries = 3, timeoutMs = 20_000, backoffMs = 1000, stopOn404 = false }: RetryOptions = {},
): Promise<RetryResult> {
  let last = '';
  let status: number | undefined;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchFn(url, {
        redirect: 'follow',
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return { ok: true, res };
      await res.body?.cancel().catch(() => {});
      status = res.status;
      last = `HTTP ${res.status}`;
      if (stopOn404 && res.status === 404) break;
    } catch (e) {
      status = undefined;
      last = e instanceof Error ? e.message : String(e);
    }
    if (attempt < retries && backoffMs > 0)
      await new Promise((r) => setTimeout(r, backoffMs * attempt));
  }
  return { ok: false, status, error: last };
}
