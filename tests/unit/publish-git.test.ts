// Real git behaviour of `publish`, against scratch bare remotes under os.tmpdir() (never this repo).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { publish } from '../../pipeline/publish';
import type { ContentReport } from '../../validators/run';

const MONTH = '2026-10';
const ID = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'];
const scratch: string[] = [];
const saved = { global: process.env.GIT_CONFIG_GLOBAL, nosystem: process.env.GIT_CONFIG_NOSYSTEM };

// Isolate from the machine's git config (signing, hooks, templates) without touching any config.
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'mkb-gitcfg-'));
  scratch.push(dir);
  writeFileSync(join(dir, 'gitconfig'), '');
  process.env.GIT_CONFIG_GLOBAL = join(dir, 'gitconfig');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});
afterAll(() => {
  for (const [k, v] of [['GIT_CONFIG_GLOBAL', saved.global], ['GIT_CONFIG_NOSYSTEM', saved.nosystem]] as const)
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A bare remote with one commit on main, and a `--single-branch` clone of it. */
function setup(): { remote: string; clone: string } {
  const base = mkdtempSync(join(tmpdir(), 'mkb-publish-'));
  scratch.push(base);
  const remote = join(base, 'remote.git');
  const seed = join(base, 'seed');
  const clone = join(base, 'clone');
  git(base, 'init', '-q', '--bare', '-b', 'main', remote);
  git(base, 'init', '-q', '-b', 'main', seed);
  write(seed, 'README.md', 'seed\n');
  write(seed, '.gitignore', 'reports/*.json\n');
  write(seed, 'content/episodes/2026-09.json', '{"episode":138}\n');
  git(seed, 'add', '.');
  git(seed, ...ID, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', remote, 'main');
  git(base, 'clone', '-q', '--single-branch', '--branch', 'main', remote, clone);
  return { remote, clone };
}

function write(root: string, rel: string, body: string) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
}

/** What the routine leaves before publishing: episode file, a scheme, the saved sources. */
function writeMonth(root: string, tag: string) {
  write(root, `content/episodes/${MONTH}.json`, JSON.stringify({ episode: 139, tag }) + '\n');
  write(root, 'content/schemes/pm-kisan.json', JSON.stringify({ id: 'pm-kisan', tag }) + '\n');
  write(root, `sources/${MONTH}/en.html`, `<p>${tag}</p>\n`);
  write(root, `sources/${MONTH}/meta.json`, JSON.stringify({ episode: 139, date: '2026-10-25' }) + '\n');
}

const report = (ok: boolean, message = 'quote mismatch'): ContentReport => ({
  month: MONTH,
  ok,
  completeLangs: [],
  warnings: 1,
  results: ok
    ? [{ check: 'machine', level: 'warning', ok: false, messages: ['kn incomplete'] }]
    : [
        { check: 'quotes', level: 'error', ok: false, messages: [message, 'second'] },
        { check: 'sources', level: 'error', ok: true, messages: [] },
        { check: 'lastSunday', level: 'warning', ok: false, messages: ['not last Sunday'] },
      ],
});

const remoteSha = (remote: string, ref: string) => {
  try {
    return git(remote, 'rev-parse', '--verify', '-q', ref);
  } catch {
    return '';
  }
};

describe('publish to drafts (single-branch clone, scratch bare remote)', { timeout: 60_000 }, () => {
  test('drafts twice: the second run replaces the first draft, leasing against the ls-remote SHA', async () => {
    const { remote, clone } = setup();
    writeMonth(clone, 'one');
    const r1 = await publish(MONTH, report(false, 'first'), { root: clone });
    expect(r1.branch).toBe(`drafts/${MONTH}`);
    const sha1 = remoteSha(remote, `refs/heads/drafts/${MONTH}`);
    expect(sha1).toMatch(/^[0-9a-f]{40}$/);
    // No earlier draft: lease requires the ref to be absent.
    expect(r1.commands.map((c) => c.join(' '))).toContain(
      `git push --force-with-lease=refs/heads/drafts/${MONTH}: -u origin drafts/${MONTH}`,
    );
    expect(r1.previousFailures).toBeNull();
    expect(git(clone, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');

    // Next day: same clone, the routine writes the month again with a different result.
    writeMonth(clone, 'two');
    const r2 = await publish(MONTH, report(false, 'second run'), { root: clone });
    const sha2 = remoteSha(remote, `refs/heads/drafts/${MONTH}`);
    expect(sha2).not.toBe(sha1);
    expect(r2.commands.map((c) => c.join(' '))).toContain(
      `git push --force-with-lease=refs/heads/drafts/${MONTH}:${sha1} -u origin drafts/${MONTH}`,
    );
    expect(r2.previousFailures).toEqual([
      { check: 'quotes', message: 'first' },
      { check: 'quotes', message: 'second' },
    ]);
    const pushed = JSON.parse(git(remote, 'show', `${sha2}:reports/${MONTH}.content.json`));
    expect(pushed.results[0].messages[0]).toBe('second run');
    expect(git(remote, 'show', `${sha2}:content/episodes/${MONTH}.json`)).toContain('"two"');
    expect(git(remote, 'show', `${sha2}:sources/${MONTH}/en.html`)).toBe('<p>two</p>');
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(git(clone, 'rev-parse', 'HEAD'));
    expect(git(clone, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });

  test('returns failures, episode, date and reportPath, and re-writes the report after restoring the branch', async () => {
    const { clone } = setup();
    writeMonth(clone, 'one');
    const r = await publish(MONTH, report(false), { root: clone });
    expect(r).toMatchObject({
      branch: `drafts/${MONTH}`,
      failures: [
        { check: 'quotes', message: 'quote mismatch' },
        { check: 'quotes', message: 'second' },
      ],
      episode: 139,
      date: '2026-10-25',
      reportPath: `reports/${MONTH}.content.json`,
    });
    const local = join(clone, 'reports', `${MONTH}.content.json`);
    expect(existsSync(local)).toBe(true);
    expect(JSON.parse(readFileSync(local, 'utf8'))).toEqual(report(false));
    // Back on main and clean (the report is git-ignored there).
    expect(git(clone, 'status', '--porcelain')).toBe('');
  });
});

describe('publish to main (scratch bare remote)', { timeout: 60_000 }, () => {
  test('passing report is committed and pushed to main; result carries episode and date', async () => {
    const { remote, clone } = setup();
    writeMonth(clone, 'ok');
    const r = await publish(MONTH, report(true), { root: clone });
    expect(r).toMatchObject({ branch: 'main', failures: [], episode: 139, date: '2026-10-25' });
    expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(git(clone, 'rev-parse', 'HEAD'));
    expect(git(remote, 'show', `main:content/episodes/${MONTH}.json`)).toContain('"ok"');
    expect(git(remote, 'log', '-1', '--format=%an <%ae>', 'main')).toBe(
      'Mann Ki Baat Routine <yawdor@users.noreply.github.com>',
    );
  });
});

describe('publish refuses a tree with changes outside the month', { timeout: 60_000 }, () => {
  test.each([
    ['a tracked file outside content/sources/reports', 'README.md'],
    ['an untracked file in the code', 'pipeline/evil.ts'],
    ["another month's episode", 'content/episodes/2026-09.json'],
    ['a nested file under content/schemes', 'content/schemes/x/y.json'],
    ["another month's sources", 'sources/2026-09/en.html'],
  ])('%s (%s), on both the main and the drafts path', async (_label, path) => {
    for (const ok of [true, false]) {
      const { remote, clone } = setup();
      writeMonth(clone, 'x');
      write(clone, path, 'changed\n');
      await expect(publish(MONTH, report(ok), { root: clone })).rejects.toThrow(
        new RegExp(`outside the allowed paths.*${path.replace(/[.]/g, '\\.')}`),
      );
      expect(git(clone, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
      expect(remoteSha(remote, `refs/heads/drafts/${MONTH}`)).toBe('');
      expect(git(remote, 'rev-list', '--count', 'main')).toBe('1');
    }
  });

  test('lists every offending path', async () => {
    const { clone } = setup();
    writeMonth(clone, 'x');
    write(clone, 'README.md', 'changed\n');
    write(clone, 'package.json', '{}\n');
    await expect(publish(MONTH, report(false), { root: clone })).rejects.toThrow(/README\.md, package\.json|package\.json, README\.md/);
  });
});
