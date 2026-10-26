import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './args';
import { runContentValidation, type ContentReport } from './run';
import { result } from './types';

const { month, root } = parseArgs(process.argv.slice(2));

if (!month) {
  console.error('usage: validate:content <YYYY-MM> [--root <dir>]');
  process.exit(2);
}

let report: ContentReport;
try {
  report = await runContentValidation(month, { root });
} catch (e) {
  const msg = `threw: ${e instanceof Error ? e.message : String(e)}`;
  report = { month, ok: false, completeLangs: [], warnings: 0, results: [result('run', 'error', [msg])] };
}
const out = join(root, 'reports', `${month}.content.json`);
mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');

const failed = report.results.filter((r) => !r.ok && r.level === 'error').map((r) => r.check);
console.log(
  `${month}: ${report.ok ? 'OK' : 'FAILED'} | langs: ${report.completeLangs.join(',') || '-'} | warnings: ${report.warnings}` +
    (failed.length ? ` | failing: ${failed.join(', ')}` : '') +
    ` | ${out}`,
);
process.exit(report.ok ? 0 : 1);
