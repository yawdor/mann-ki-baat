import { resolve } from 'node:path';

/** `<month> [--root <dir>] [--offline]` in any order. */
export function parseArgs(argv: string[]): { month?: string; root: string; offline: boolean } {
  const rootIdx = argv.indexOf('--root');
  const root = resolve(rootIdx >= 0 ? (argv[rootIdx + 1] ?? '.') : '.');
  const month = argv.find((a, i) => !a.startsWith('--') && !(rootIdx >= 0 && i === rootIdx + 1));
  return { month, root, offline: argv.includes('--offline') };
}
