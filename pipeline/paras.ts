import { parse } from 'node-html-parser';

export const TRANSCRIPT_SELECTOR = 'div.news-bg > p';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const STAFF_INITIALS = /^[A-Z]{2,}(\/[A-Z]{2,})+$/;

const clean = (s: string) => s.replace(/[\s ]+/g, ' ').trim();

/**
 * pmindia pages embed a stray `<!DOCTYPE>` and `<html><body>` inside the first transcript
 * paragraph, which makes the parser swallow the whole transcript into one node. Drop them.
 */
function sanitize(html: string): string {
  return html.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?(?:html|body)\b[^>]*>/gi, '');
}

/** Non-empty paragraphs in document order; skips tweets, the video-embed paragraph and ">>>" junk. */
export function extractParagraphs(html: string, selector: string): string[] {
  const root = parse(sanitize(html));
  const out: string[] = [];
  for (const p of root.querySelectorAll(selector)) {
    if (p.closest('div.tweet-container') || p.querySelector('iframe')) continue;
    const t = clean(p.text);
    if (t === '' || t === '>>>') continue;
    out.push(t);
  }
  // Hindi pages end with the PIB staff-initials line (e.g. "MJPS/SS/VJ/VK"); it is not speech.
  if (out.length && STAFF_INITIALS.test(out[out.length - 1])) out.pop();
  return out;
}

/** "25 Oct, 2026" -> "2026-10-25" (null when it does not parse). */
export function parsePageDate(s: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/.exec(s);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2].toLowerCase());
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function parseTranscript(html: string): {
  episode: number | null;
  date: string | null;
  paragraphs: string[];
} {
  const root = parse(sanitize(html));
  const h2 = root.querySelector('div.content-block h2');
  const num = h2 ? /\d+/.exec(h2.text) : null;
  const dateEl = root.querySelector('div.share_date span.date');
  return {
    episode: num ? Number(num[0]) : null,
    date: dateEl ? parsePageDate(dateEl.text) : null,
    paragraphs: extractParagraphs(html, TRANSCRIPT_SELECTOR),
  };
}
