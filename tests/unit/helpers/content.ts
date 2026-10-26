import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EpisodeSchema, SchemeSchema, type Episode, type Scheme } from '../../../src/lib/schema';
import type { ValidationContext } from '../../../validators/types';

const FX = 'tests/fixtures';
export const loadFx = (p: string) => JSON.parse(readFileSync(`${FX}/${p}.json`, 'utf8'));

type Obj = Record<string, any>;
function walk(o: Obj, path: string[]) {
  let cur: Obj = o;
  for (const k of path.slice(0, -1)) cur = cur[k];
  return { parent: cur, key: path[path.length - 1] };
}

export type BrokenFixture = {
  base: string;
  set?: Record<string, unknown>;
  delete?: string[];
  truncate?: Record<string, number>;
  expect: string;
};

/** Applies a broken-fixture patch to a deep copy of its base fixture. */
export function applyBroken(name: string): { raw: any; spec: BrokenFixture } {
  const spec: BrokenFixture = JSON.parse(readFileSync(`${FX}/broken/${name}.json`, 'utf8'));
  const raw = loadFx(spec.base);
  for (const [p, v] of Object.entries(spec.set ?? {})) {
    const { parent, key } = walk(raw, p.split('.'));
    parent[key] = v;
  }
  for (const p of spec.delete ?? []) {
    const { parent, key } = walk(raw, p.split('.'));
    delete parent[key];
  }
  for (const [p, n] of Object.entries(spec.truncate ?? {})) raw[p].length = n;
  return { raw, spec };
}

export function baseSchemes(): Map<string, Scheme> {
  return new Map(
    ['pm-kisan', 'sample-mention'].map((n) => {
      const s = SchemeSchema.parse(loadFx(`schemes/${n}`));
      return [s.id, s];
    }),
  );
}

/** Context for the given (possibly patched) raw data. Schemes patched when the fixture's base is a scheme. */
export function ctxFor(name?: string, overrides: Partial<ValidationContext> = {}): ValidationContext {
  let episode: Episode = EpisodeSchema.parse(loadFx('episodes/2026-09'));
  const schemes = baseSchemes();
  if (name) {
    const { raw, spec } = applyBroken(name);
    if (spec.base.startsWith('schemes/')) schemes.set(raw.id, raw as Scheme);
    else episode = raw as Episode;
  }
  return {
    root: FX,
    month: '2026-09',
    episode,
    schemes,
    paras: { en: loadFx('sources/2026-09/en.paras'), hi: loadFx('sources/2026-09/hi.paras') },
    previous: EpisodeSchema.parse(loadFx('episodes/2026-08')),
    fetch: (async () => new Response(null, { status: 200 })) as typeof fetch,
    ...overrides,
  };
}

/** Temp root laid out as content/ + sources/, copied from fixtures, optionally patched. */
export function makeRoot(
  opts: { month?: string; episode?: unknown; scheme?: [string, unknown]; meta?: Record<string, unknown> } = {},
): string {
  const month = opts.month ?? '2026-09';
  const root = mkdtempSync(join(tmpdir(), 'mkb-'));
  mkdirSync(join(root, 'content'), { recursive: true });
  cpSync(`${FX}/episodes`, join(root, 'content', 'episodes'), { recursive: true });
  cpSync(`${FX}/schemes`, join(root, 'content', 'schemes'), { recursive: true });
  cpSync(`${FX}/sources`, join(root, 'sources'), { recursive: true });
  if (opts.episode)
    writeFileSync(join(root, 'content', 'episodes', `${month}.json`), JSON.stringify(opts.episode));
  if (opts.meta) {
    const p = join(root, 'sources', month, 'meta.json');
    writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), ...opts.meta }, null, 2) + '\n');
  }
  if (opts.scheme)
    writeFileSync(join(root, 'content', 'schemes', `${opts.scheme[0]}.json`), JSON.stringify(opts.scheme[1]));
  return root;
}
