import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseTranscript } from '../../pipeline/paras';
import { result, type Check } from '../types';

const LANGS = ['en', 'hi'] as const;

/**
 * The saved official pages are the evidence for every quote and paragraph reference, so they must be
 * exactly what was fetched: the episode file agrees with `sources/<month>/meta.json`, each saved HTML
 * file still has the recorded sha256, and each `<lang>.paras.json` is exactly what re-parsing that
 * HTML gives.
 */
export const evidence: Check = (ctx) => {
  const messages: string[] = [];
  const rel = (f: string) => `sources/${ctx.month}/${f}`;
  const abs = (f: string) => join(ctx.root, 'sources', ctx.month, f);
  const readJson = (f: string): unknown => {
    if (!existsSync(abs(f))) return void messages.push(`${rel(f)} is missing`);
    try {
      return JSON.parse(readFileSync(abs(f), 'utf8'));
    } catch (e) {
      return void messages.push(`${rel(f)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const meta = readJson('meta.json') as
    | { episode?: unknown; date?: unknown; urls?: Record<string, unknown>; sha256?: Record<string, unknown> }
    | undefined;
  const ep = ctx.episode;
  if (meta) {
    if (ep.episode !== meta.episode)
      messages.push(`episode ${ep.episode} does not match ${rel('meta.json')} episode ${String(meta.episode)}`);
    if (ep.date !== meta.date)
      messages.push(`date ${ep.date} does not match ${rel('meta.json')} date ${String(meta.date)}`);
  }

  for (const lang of LANGS) {
    if (meta && ep.sources[lang] !== meta.urls?.[lang])
      messages.push(`sources.${lang} ${ep.sources[lang]} does not match meta.urls.${lang} ${String(meta.urls?.[lang])}`);
    const html = `${lang}.html`;
    if (!existsSync(abs(html))) {
      messages.push(`${rel(html)} is missing`);
      continue;
    }
    const bytes = readFileSync(abs(html));
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (meta && sha !== meta.sha256?.[lang])
      messages.push(`${rel(html)}: sha256 ${sha} does not match meta.sha256.${lang} ${String(meta.sha256?.[lang])}`);
    const saved = readJson(`${lang}.paras.json`);
    if (saved === undefined) continue;
    const parsed = parseTranscript(bytes.toString('utf8')).paragraphs;
    if (!isDeepStrictEqual(saved, parsed)) {
      const list = Array.isArray(saved) ? saved : [];
      let i = 0;
      while (i < Math.max(list.length, parsed.length) && list[i] === parsed[i]) i++;
      messages.push(
        `${rel(`${lang}.paras.json`)} does not match the paragraphs parsed from ${html} ` +
          `(${list.length} saved vs ${parsed.length} parsed; first difference at paragraph ${i + 1})`,
      );
    }
  }
  return result('evidence', 'error', messages);
};
