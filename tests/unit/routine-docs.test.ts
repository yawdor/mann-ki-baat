import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { ACCENTS, AUDIENCES, CATEGORIES, MOTIFS } from '../../src/lib/schema';

// The monthly routine follows these Markdown files with no human review, so they must stay in
// step with the code they describe.
const read = (p: string) => readFileSync(p, 'utf8');
const routine = read('pipeline/ROUTINE.md');
const rules = read('pipeline/EXTRACT_RULES.md');
const notify = read('pipeline/notify.md');

/** Subcommands handled by the pipeline CLI (`case '<name>':` in its switch). */
const subcommands = [...read('pipeline/cli.ts').matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]);

describe('ROUTINE.md', () => {
  test('the CLI has subcommands to check', () => {
    expect(subcommands).toEqual(expect.arrayContaining(['should-run', 'discover', 'save-sources', 'publish']));
  });

  test.each(subcommands)('runs `npm run pipeline -- %s`', (cmd) => {
    expect(routine).toContain(`npm run pipeline -- ${cmd}`);
  });

  test('runs the validate:content script, which exists in package.json', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['validate:content']).toBeDefined();
    expect(routine).toContain('npm run validate:content -- ');
  });

  test('names the only writable directories', () => {
    for (const dir of ['content/', 'sources/', 'reports/']) expect(routine).toContain(dir);
    expect(routine).toContain('--no-verify');
  });
});

describe('EXTRACT_RULES.md', () => {
  test.each([...CATEGORIES])('lists category %s', (c) => {
    expect(rules).toContain(`\`${c}\``);
  });

  test.each([...MOTIFS])('lists motif %s', (m) => {
    expect(rules).toContain(`\`${m}\``);
  });

  test.each([...ACCENTS])('lists accent %s from schema.ts', (a) => {
    expect(rules).toContain(`\`${a}\``);
  });

  test.each([...AUDIENCES])('lists audience %s', (a) => {
    expect(rules).toContain(`\`${a}\``);
  });
});

describe('notify.md', () => {
  test.each([
    '✅ Mann Ki Baat <Month YYYY> is live',
    '⚠️ Mann Ki Baat <Month YYYY> not published',
    'ℹ️ No Mann Ki Baat transcript found for <Month YYYY>',
  ])('has the subject line "%s"', (subject) => {
    expect(notify).toContain(subject);
  });

  test('sends to the owner address', () => {
    expect(notify).toContain('pandith.ajith@gmail.com');
  });
});
