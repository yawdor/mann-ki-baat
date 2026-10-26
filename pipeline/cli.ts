import { resolve } from 'node:path';
import { MONTH_RE } from '../src/lib/schema';
import { discoverEpisode } from './discover';
import { saveSources } from './fetch';
import { publish, readReport } from './publish';
import { shouldRun } from './window';

const USAGE =
  'usage: pipeline <should-run [--now ISO] | discover <month> | save-sources <month> <enUrl> <hiUrl> | publish <month> [--dry-run]> [--root <dir>]';

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Positional args: everything that is not a flag or a flag's value. */
function positionals(argv: string[]): string[] {
  const valued = new Set(['--now', '--root']);
  return argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1] ?? ''));
}

function needMonth(m: string | undefined): string {
  if (!m || !MONTH_RE.test(m)) throw new Error(`expected a month like 2026-10, got "${m ?? ''}"`);
  return m;
}

export async function main(argv: string[]): Promise<unknown> {
  const [cmd, ...rest] = argv;
  const root = resolve(flag(rest, '--root') ?? '.');
  const pos = positionals(rest);
  switch (cmd) {
    case 'should-run': {
      const nowArg = flag(rest, '--now');
      const now = nowArg ? new Date(nowArg) : new Date();
      if (Number.isNaN(now.getTime())) throw new Error(`invalid --now "${nowArg}"`);
      return shouldRun(now, root);
    }
    case 'discover': {
      const month = needMonth(pos[0]);
      const found = await discoverEpisode({ fetch, month });
      return found ?? { episode: null, month, reason: `no episode dated in ${month} found` };
    }
    case 'save-sources': {
      const month = needMonth(pos[0]);
      if (!pos[1] || !pos[2]) throw new Error('save-sources needs <enUrl> <hiUrl>');
      return await saveSources(month, { en: pos[1], hi: pos[2] }, { root, fetch });
    }
    case 'publish': {
      const month = needMonth(pos[0]);
      const report = readReport(root, month);
      return await publish(month, report, { root, dryRun: rest.includes('--dry-run') });
    }
    default:
      throw new Error(USAGE);
  }
}

main(process.argv.slice(2)).then(
  (out) => {
    process.stdout.write(JSON.stringify(out) + '\n');
  },
  (e) => {
    process.stdout.write(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) + '\n');
    process.exitCode = 1;
  },
);
