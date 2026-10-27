// Offline validation (every check except `links`) of every episode in content/episodes.
// Used by the deploy job before building: `npm run validate:all-offline [-- --root <dir>]`.
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MONTH_RE } from '../src/lib/schema';
import { runContentValidation, type ContentReport } from './run';

export async function validateAllOffline(root: string): Promise<ContentReport[]> {
  const dir = join(root, 'content', 'episodes');
  if (!existsSync(dir)) return [];
  const months = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
  const reports: ContentReport[] = [];
  for (const month of months) {
    if (!MONTH_RE.test(month)) {
      reports.push({
        month,
        ok: false,
        completeLangs: [],
        warnings: 0,
        results: [{ check: 'load', level: 'error', ok: false, messages: [`${month}.json is not named <YYYY-MM>.json`] }],
      });
      continue;
    }
    reports.push(await runContentValidation(month, { root, offline: true }));
  }
  return reports;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const i = process.argv.indexOf('--root');
  const root = resolve(i >= 0 ? (process.argv[i + 1] ?? '.') : '.');
  const reports = await validateAllOffline(root);
  if (!reports.length) console.log('validate:all-offline: no episodes in content/episodes, nothing to check');
  for (const r of reports) {
    const failing = r.results.filter((x) => !x.ok && x.level === 'error');
    console.log(`${r.month}: ${r.ok ? 'OK' : 'FAILED'} | warnings: ${r.warnings}`);
    for (const f of failing) for (const m of f.messages) console.log(`  ${f.check}: ${m}`);
  }
  process.exit(reports.every((r) => r.ok) ? 0 : 1);
}
