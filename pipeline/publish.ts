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
/** Dry-run placeholder for the SHA that `git ls-remote` would report for the old draft. */
const REMOTE_SHA = '<remote-sha>';

export type Failure = { check: string; message: string };

export type PublishResult = {
  branch: 'main' | `drafts/${string}`;
  /** Every git argv in order (placeholders `<original-branch>` / `<remote-sha>` in a dry run). */
  commands: string[][];
  /** Every failing error-level `<check>: <message>` pair of the report ([] on main). */
  failures: Failure[];
  /** From `sources/<month>/meta.json` (null when it is missing or unreadable). */
  episode: number | null;
  date: string | null;
  /** The report, re-written in the working tree after publishing (relative to the root). */
  reportPath: string;
  /**
   * Drafts only: the failures recorded in the draft this run replaced, or null when there was no
   * earlier draft (or its report could not be read). Used to avoid repeating a Failure email.
   */
  previousFailures?: Failure[] | null;
};

export function failuresOf(report: Pick<ContentReport, 'results'>): Failure[] {
  return (Array.isArray(report.results) ? report.results : [])
    .filter((r) => r.level === 'error' && !r.ok)
    .flatMap((r) => (r.messages.length ? r.messages : ['(no message)']).map((message) => ({ check: r.check, message })));
}

function readJson(p: string): Record<string, unknown> | undefined {
  try {
    const v = JSON.parse(readFileSync(p, 'utf8'));
    return v && typeof v === 'object' ? v : undefined;
  } catch {
    return undefined;
  }
}

function sourceMeta(root: string, month: string): { episode: number | null; date: string | null } {
  const meta = readJson(join(root, 'sources', month, 'meta.json'));
  return {
    episode: typeof meta?.episode === 'number' ? meta.episode : null,
    date: typeof meta?.date === 'string' ? meta.date : null,
  };
}

function episodeNumber(root: string, month: string): number | undefined {
  for (const p of [
    join(root, 'content', 'episodes', `${month}.json`),
    join(root, 'sources', month, 'meta.json'),
  ]) {
    const n = readJson(p)?.episode;
    if (typeof n === 'number') return n;
  }
  return undefined;
}

function commitMessage(month: string, episode: number | undefined, draft: boolean): string {
  const [y, m] = month.split('-');
  const label = `Mann Ki Baat ${MONTH_NAMES[Number(m) - 1]} ${y}${episode ? ` (episode ${episode})` : ''}`;
  return `${draft ? 'draft: failed validation, ' : 'content: '}${label}\n\n${CO_AUTHOR}`;
}

/** Paths publish may commit: this month's episode, scheme records, this month's sources and report. */
export function allowedPath(month: string, path: string): boolean {
  return (
    path === `content/episodes/${month}.json` ||
    /^content\/schemes\/[^/]+\.json$/.test(path) ||
    path.startsWith(`sources/${month}/`) ||
    path === `reports/${month}.content.json`
  );
}

/** Paths in `git status --porcelain -z` output (both sides of a rename or copy). */
export function porcelainPaths(out: string): string[] {
  const tokens = out.split('\0');
  const paths: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.length < 4) continue;
    paths.push(t.slice(3));
    if (/[RC]/.test(t.slice(0, 2)) && i + 1 < tokens.length) paths.push(tokens[++i]);
  }
  return paths;
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
  const reportRel = `reports/${month}.content.json`;
  const info = { failures: ok ? [] : failuresOf(report), ...sourceMeta(root, month), reportPath: reportRel };
  const git = (...args: string[]) => ['git', ...args];
  const gitRun = (args: string[]) => run('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const currentBranch = async () => (await gitRun(['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  /** Refuse to commit anything the routine was not allowed to touch. */
  const assertOnlyMonthChanges = async () => {
    const { stdout } = await gitRun(['status', '--porcelain', '-z', '--untracked-files=all']);
    const outside = [...new Set(porcelainPaths(stdout).filter((p) => !allowedPath(month, p)))].sort();
    if (outside.length)
      throw new Error(
        `refusing to publish: the working tree has changes outside the allowed paths ` +
          `(content/episodes/${month}.json, content/schemes/*.json, sources/${month}/, ${reportRel}): ${outside.join(', ')}`,
      );
  };

  if (ok) {
    const commands = [
      git('add', 'content', 'sources'),
      git(...IDENTITY, 'commit', '-m', commitMessage(month, episode, false), '--', 'content', 'sources'),
      git('push', 'origin', 'HEAD:main'),
    ];
    if (dryRun) return { branch: 'main', commands, ...info };
    const cur = await currentBranch();
    if (cur !== 'main') throw new Error(`refusing to publish to main from branch "${cur}"; check out main first`);
    await assertOnlyMonthChanges();
    for (const [, ...args] of commands) await gitRun(args);
    return { branch: 'main', commands, ...info };
  }

  const branch = `drafts/${month}` as const;
  const ref = `refs/heads/${branch}`;
  const present = ['content', 'sources'].filter((d) => existsSync(join(root, d)));
  const lsRemote = git('ls-remote', 'origin', ref);
  const plan = (orig: string, remoteSha: string) => [
    git('checkout', '-B', branch),
    ...(present.length ? [git('add', ...present)] : []),
    git('add', '-f', reportRel),
    git(...IDENTITY, 'commit', '-m', commitMessage(month, episode, true), '--', ...present, reportRel),
    // checkout -B rebuilds the branch from the current HEAD, so a re-run diverges from the old draft.
    // Lease explicitly against the SHA ls-remote saw (empty = the ref must not exist yet): a
    // single-branch or shallow clone has no remote-tracking ref for a bare --force-with-lease.
    git('push', `--force-with-lease=${ref}:${remoteSha}`, '-u', 'origin', branch),
    git('checkout', orig),
  ];
  if (dryRun)
    return { branch, commands: [lsRemote, ...plan('<original-branch>', REMOTE_SHA)], ...info, previousFailures: null };

  const original = await currentBranch();
  if (original === 'HEAD') throw new Error('refusing to publish a draft from a detached HEAD');
  await assertOnlyMonthChanges();

  const commands: string[][] = [lsRemote];
  const remoteSha = (await gitRun(lsRemote.slice(1))).stdout.trim().split(/\s+/)[0] ?? '';
  if (remoteSha && !/^[0-9a-f]{40,64}$/.test(remoteSha))
    throw new Error(`unexpected ls-remote output for ${ref}: ${remoteSha}`);
  let previousFailures: Failure[] | null = null;
  if (remoteSha) {
    // Read the failures recorded by the draft this run is about to replace (FETCH_HEAD only).
    const fetch = git('fetch', '--no-tags', 'origin', ref);
    const show = git('show', `FETCH_HEAD:${reportRel}`);
    commands.push(fetch, show);
    try {
      await gitRun(fetch.slice(1));
      const prev = JSON.parse((await gitRun(show.slice(1))).stdout) as ContentReport;
      previousFailures = failuresOf(prev);
    } catch {
      previousFailures = null;
    }
  }

  const steps = plan(original, remoteSha);
  commands.push(...steps);
  const reportAbs = join(root, reportRel);
  const reportJson = JSON.stringify(report, null, 2) + '\n';
  const writeReport = () => {
    mkdirSync(dirname(reportAbs), { recursive: true });
    writeFileSync(reportAbs, reportJson);
  };
  writeReport();
  let switched = false;
  let failure: unknown;
  try {
    for (const [, ...args] of steps.slice(0, -1)) {
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
  // Checking out the original branch removes the files only the draft tracks, the report among
  // them. Put the report back so it stays readable locally (it is git-ignored on main).
  writeReport();
  if (failure !== undefined) throw failure;
  return { branch, commands, ...info, previousFailures };
}
