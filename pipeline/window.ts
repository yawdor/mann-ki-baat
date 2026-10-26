import { existsSync } from 'node:fs';
import { join } from 'node:path';

const IST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function istParts(now: Date): { y: number; m: number; d: number } {
  const p = Object.fromEntries(IST.formatToParts(now).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

const fmt = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

/**
 * The episode month the routine should work on, judged in IST.
 * Day 26 to month end: this month. Days 1-4: the previous month. Otherwise null.
 */
export function targetMonth(now: Date): string | null {
  const { y, m, d } = istParts(now);
  if (d >= 26) return fmt(y, m);
  if (d <= 4) return m === 1 ? fmt(y - 1, 12) : fmt(y, m - 1);
  return null;
}

export function shouldRun(
  now: Date,
  root: string,
): { run: boolean; month: string | null; reason: string } {
  const month = targetMonth(now);
  if (!month) return { run: false, month: null, reason: 'outside the 26th-4th run window (IST)' };
  if (existsSync(join(root, 'content', 'episodes', `${month}.json`)))
    return { run: false, month, reason: `content/episodes/${month}.json already exists` };
  return { run: true, month, reason: `no episode file for ${month} yet` };
}
