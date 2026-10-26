import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CATEGORIES, EpisodeSchema, SchemeSchema,
  type Category, type Episode, type Scheme,
} from './schema';
import { referencedSchemes } from './langs';

export { LANGS, type Lang } from './schema';
export { completeLangs } from './langs';

const contentRoot = () => process.env.MKB_CONTENT_DIR ?? 'content';

function readDir<T>(dir: string, parse: (raw: unknown) => T): { file: string; value: T }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      try {
        return { file, value: parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8'))) };
      } catch (e) {
        throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
}

/** Validated episodes, newest first. A missing directory yields []; an invalid file throws. */
export function loadEpisodes(dir = path.join(contentRoot(), 'episodes')): Episode[] {
  return readDir(dir, (r) => EpisodeSchema.parse(r))
    .map((x) => x.value)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function loadSchemes(dir = path.join(contentRoot(), 'schemes')): Map<string, Scheme> {
  return new Map(readDir(dir, (r) => SchemeSchema.parse(r)).map((x) => [x.value.id, x.value]));
}

export function deriveCounts(ep: Episode, schemes: Map<string, Scheme>) {
  return {
    topics: ep.topics.length,
    schemes: referencedSchemes(ep, schemes).length,
    people: ep.people.length,
    states: new Set(ep.places.map((p) => p.state)).size,
  };
}

export function buildTrends(
  eps: Episode[],
  lastN = 6,
): { months: string[]; rows: { category: Category; values: number[] }[] } {
  const picked = [...eps].sort((a, b) => b.date.localeCompare(a.date)).slice(0, lastN).reverse();
  return {
    months: picked.map((e) => e.date.slice(0, 7)),
    rows: CATEGORIES.map((category) => ({
      category,
      values: picked.map((e) => e.topics.filter((t) => t.category === category).length),
    })),
  };
}
