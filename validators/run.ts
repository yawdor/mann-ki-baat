import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EpisodeSchema,
  MONTH_RE,
  SchemeSchema,
  type Episode,
  type Lang,
  type Scheme,
} from '../src/lib/schema';
import { completeLangs } from '../src/lib/langs';
import { schemaCheck } from './checks/schema';
import { evidence } from './checks/evidence';
import { quotes } from './checks/quotes';
import { quiz } from './checks/quiz';
import { sources } from './checks/sources';
import { links } from './checks/links';
import { languages, machineLanguages } from './checks/languages';
import { noGuessing } from './checks/noGuessing';
import { sanity, lastSunday } from './checks/sanity';
import { result, type Check, type CheckResult, type ValidationContext } from './types';

export type ContentReport = {
  month: string;
  ok: boolean;
  completeLangs: Lang[];
  warnings: number;
  results: CheckResult[];
};

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

export const CHECKS: Check[] = [
  evidence,
  quotes,
  quiz,
  sources,
  links,
  languages,
  machineLanguages,
  noGuessing,
  sanity,
  lastSunday,
];

function finish(month: string, results: CheckResult[], langs: Lang[]): ContentReport {
  const ok = results.every((r) => r.ok || r.level !== 'error');
  const warnings = results
    .filter((r) => r.level === 'warning' && !r.ok)
    .reduce((n, r) => n + r.messages.length, 0);
  return { month, ok, completeLangs: ok ? langs : [], warnings, results };
}

export async function runContentValidation(
  month: string,
  /** `offline` skips the `links` check, so nothing is fetched. */
  opts: { root: string; fetch?: typeof fetch; offline?: boolean },
): Promise<ContentReport> {
  const { root } = opts;
  const fail = (msg: string) => finish(month, [result('load', 'error', [msg])], []);
  if (!MONTH_RE.test(month)) return fail(`"${month}" is not a valid month (YYYY-MM)`);

  // Load raw files; any unreadable or unparsable file is a load/schema failure.
  const loadMessages: string[] = [];
  const read = (p: string): unknown => {
    try {
      return readJson(p);
    } catch (e) {
      loadMessages.push(`${p}: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  };
  const epPath = join(root, 'content', 'episodes', `${month}.json`);
  if (!existsSync(epPath)) return fail(`missing episode file ${epPath}`);
  const rawEpisode = read(epPath);

  const rawSchemes = new Map<string, unknown>();
  const schemeDir = join(root, 'content', 'schemes');
  if (existsSync(schemeDir))
    for (const f of readdirSync(schemeDir).filter((f) => f.endsWith('.json')).sort())
      rawSchemes.set(f, read(join(schemeDir, f)));

  const paras: Record<'en' | 'hi', string[]> = { en: [], hi: [] };
  for (const lang of ['en', 'hi'] as const) {
    const p = join(root, 'sources', month, `${lang}.paras.json`);
    const v = existsSync(p) ? read(p) : (loadMessages.push(`missing transcript ${p}`), undefined);
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) paras[lang] = v as string[];
    else if (v !== undefined) loadMessages.push(`${p}: expected a JSON array of strings`);
  }

  const results: CheckResult[] = [];
  if (loadMessages.length) results.push(result('load', 'error', loadMessages));
  const schemaResult = schemaCheck(rawEpisode, rawSchemes);
  results.push(schemaResult);
  if (!schemaResult.ok || loadMessages.length) return finish(month, results, []);

  const episode: Episode = EpisodeSchema.parse(rawEpisode);
  const schemes = new Map<string, Scheme>();
  for (const raw of rawSchemes.values()) {
    const s = SchemeSchema.parse(raw);
    schemes.set(s.id, s);
  }

  // Previous episode: latest episode file with a smaller month.
  let previous: Episode | undefined;
  const epDir = join(root, 'content', 'episodes');
  const earlier = readdirSync(epDir)
    .map((f) => f.replace(/\.json$/, ''))
    .filter((m) => MONTH_RE.test(m) && m < month)
    .sort();
  const prevMonth = earlier[earlier.length - 1];
  const prevMessages: string[] = [];
  if (prevMonth) {
    const pPath = join(epDir, `${prevMonth}.json`);
    try {
      const p = EpisodeSchema.safeParse(readJson(pPath));
      if (p.success) previous = p.data;
      else
        prevMessages.push(
          `previous episode ${prevMonth} fails the schema: ${p.error.issues[0]?.message ?? 'invalid'}`,
        );
    } catch (e) {
      prevMessages.push(
        `previous episode ${prevMonth} unreadable: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  if (prevMessages.length) results.push(result('previous', 'error', prevMessages));

  const ctx: ValidationContext = {
    root,
    month,
    episode,
    schemes,
    paras,
    previous,
    fetch: opts.fetch ?? fetch,
  };
  for (const check of opts.offline ? CHECKS.filter((c) => c !== links) : CHECKS) {
    try {
      results.push(await check(ctx));
    } catch (e) {
      results.push(result(check.name || 'check', 'error', [`threw: ${e instanceof Error ? e.message : String(e)}`]));
    }
  }
  return finish(month, results, completeLangs(episode, schemes));
}
