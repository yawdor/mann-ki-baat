import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runContentValidation } from './run';

const args = process.argv.slice(2);
const rootIdx = args.indexOf('--root');
const root = resolve(rootIdx >= 0 ? (args[rootIdx + 1] ?? '.') : '.');
const month = args.find((a, i) => !a.startsWith('--') && i !== rootIdx + 1);

if (!month) {
  console.error('usage: validate:content <YYYY-MM> [--root <dir>]');
  process.exit(2);
}

const report = await runContentValidation(month, { root });
mkdirSync(join(root, 'reports'), { recursive: true });
const out = join(root, 'reports', `${month}.content.json`);
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');

const failed = report.results.filter((r) => !r.ok && r.level === 'error').map((r) => r.check);
console.log(
  `${month}: ${report.ok ? 'OK' : 'FAILED'} | langs: ${report.completeLangs.join(',') || '-'} | warnings: ${report.warnings}` +
    (failed.length ? ` | failing: ${failed.join(', ')}` : '') +
    ` | ${out}`,
);
process.exit(report.ok ? 0 : 1);
