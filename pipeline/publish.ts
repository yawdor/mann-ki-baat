import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { ContentReport } from '../validators/run';

const run = promisify(execFile);

const CO_AUTHOR = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type PublishResult = {
  branch: 'main' | `drafts/${string}`;
  /** Every git argv in order (placeholders `<original-branch>` when planned in a dry run). */
  commands: string[][];
};

function episodeNumber(root: string, month: string): number | undefined {
  for (const p of [
    join(root, 'content', 'episodes', `${month}.json`),
    join(root, 'sources', month, 'meta.json'),
  ]) {
    try {
      const n = JSON.parse(readFileSync(p, 'utf8')).episode;
      if (typeof n === 'number') return n;
    } catch {
      /* try the next source */
    }
  }
  return undefined;
}

function commitMessage(month: string, episode: number | undefined, draft: boolean): string {
  const [y, m] = month.split('-');
  const label = `Mann Ki Baat ${MONTH_NAMES[Number(m) - 1]} ${y}${episode ? ` (episode ${episode})` : ''}`;
  return `${draft ? 'draft: failed validation, ' : 'content: '}${label}\n\n${CO_AUTHOR}`;
}

export async function publish(
  month: string,
  report: ContentReport,
  opts: { root: string; dryRun?: boolean },
): Promise<PublishResult> {
  const { root, dryRun = false } = opts;
  const episode = episodeNumber(root, month);
  const git = (...args: string[]) => ['git', ...args];

  if (report.ok) {
    const commands = [
      git('add', 'content', 'sources'),
      git('commit', '-m', commitMessage(month, episode, false)),
      git('push', 'origin', 'HEAD:main'),
    ];
    if (!dryRun) for (const [, ...args] of commands) await run('git', args, { cwd: root });
    return { branch: 'main', commands };
  }

  const branch = `drafts/${month}` as const;
  const reportRel = `reports/${month}.content.json`;
  const plan = (orig: string) => [
    git('checkout', '-B', branch),
    git('add', 'content', 'sources'),
    git('add', '-f', reportRel),
    git('commit', '-m', commitMessage(month, episode, true)),
    git('push', '-u', 'origin', branch),
    git('checkout', orig),
  ];
  if (dryRun) return { branch, commands: plan('<original-branch>') };

  const { stdout } = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
  const original = stdout.trim();
  const commands = plan(original);
  const reportAbs = join(root, reportRel);
  mkdirSync(dirname(reportAbs), { recursive: true });
  writeFileSync(reportAbs, JSON.stringify(report, null, 2) + '\n');
  let switched = false;
  try {
    for (const [i, [, ...args]] of commands.entries()) {
      if (i === commands.length - 1) break; // switching back happens in finally
      await run('git', args, { cwd: root });
      switched = true;
    }
  } finally {
    if (switched) await run('git', ['checkout', original], { cwd: root });
  }
  return { branch, commands };
}

export function readReport(root: string, month: string): ContentReport {
  const p = join(root, 'reports', `${month}.content.json`);
  if (!existsSync(p)) throw new Error(`missing ${p}; run validate:content first`);
  return JSON.parse(readFileSync(p, 'utf8')) as ContentReport;
}
