import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { MONTH_RE } from '../src/lib/schema';
import type { ContentReport } from '../validators/run';

const run = promisify(execFile);

const CO_AUTHOR = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
/** Committer identity passed per command, so the routine never has to run `git config`. */
const IDENTITY = ['-c', 'user.name=Mann Ki Baat Routine', '-c', 'user.email=yawdor@users.noreply.github.com'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type PublishResult = {
  branch: 'main' | `drafts/${string}`;
  /** Every git argv in order (placeholder `<original-branch>` when planned in a dry run). */
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
  if (!MONTH_RE.test(month)) throw new Error(`"${month}" is not a valid month (YYYY-MM)`);
  if (report.month !== month)
    throw new Error(`report is for ${String(report.month)}, not ${month}; refusing to publish`);
  const ok = report.ok === true; // strict: anything else is treated as failing
  const episode = episodeNumber(root, month);
  const git = (...args: string[]) => ['git', ...args];
  const gitRun = (args: string[]) => run('git', args, { cwd: root });
  const currentBranch = async () => (await gitRun(['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();

  if (ok) {
    const commands = [
      git('add', 'content', 'sources'),
      git(...IDENTITY, 'commit', '-m', commitMessage(month, episode, false), '--', 'content', 'sources'),
      git('push', 'origin', 'HEAD:main'),
    ];
    if (dryRun) return { branch: 'main', commands };
    const cur = await currentBranch();
    if (cur !== 'main') throw new Error(`refusing to publish to main from branch "${cur}"; check out main first`);
    for (const [, ...args] of commands) await gitRun(args);
    return { branch: 'main', commands };
  }

  const branch = `drafts/${month}` as const;
  const reportRel = `reports/${month}.content.json`;
  const present = ['content', 'sources'].filter((d) => existsSync(join(root, d)));
  const plan = (orig: string) => [
    git('checkout', '-B', branch),
    ...(present.length ? [git('add', ...present)] : []),
    git('add', '-f', reportRel),
    git(...IDENTITY, 'commit', '-m', commitMessage(month, episode, true), '--', ...present, reportRel),
    // checkout -B rebuilds the branch from the current HEAD, so a re-run diverges from the old remote draft.
    git('push', '--force-with-lease', '-u', 'origin', branch),
    git('checkout', orig),
  ];
  if (dryRun) return { branch, commands: plan('<original-branch>') };

  const original = await currentBranch();
  if (original === 'HEAD') throw new Error('refusing to publish a draft from a detached HEAD');
  const commands = plan(original);
  const reportAbs = join(root, reportRel);
  mkdirSync(dirname(reportAbs), { recursive: true });
  writeFileSync(reportAbs, JSON.stringify(report, null, 2) + '\n');
  let switched = false;
  let failure: unknown;
  try {
    for (const [, ...args] of commands.slice(0, -1)) {
      switched = true;
      await gitRun(args);
    }
  } catch (e) {
    failure = e;
  }
  if (switched) {
    try {
      await gitRun(['checkout', original]);
    } catch (restoreErr) {
      if (failure === undefined) throw restoreErr;
      throw new Error(
        `${failure instanceof Error ? failure.message : String(failure)} (and restoring branch "${original}" failed)`,
        { cause: restoreErr },
      );
    }
  }
  if (failure !== undefined) throw failure;
  return { branch, commands };
}
