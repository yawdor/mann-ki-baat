import { isOfficialUrl, type Episode, type Source } from '../../src/lib/schema';
import { result, type Check } from '../types';

export type SourceRef = { path: string; source: Source };

export function allSources(ep: Episode): SourceRef[] {
  const out: SourceRef[] = [];
  ep.topics.forEach((t, i) =>
    t.facts.forEach((f, j) => out.push({ path: `topics[${i}].facts[${j}].source`, source: f.source })),
  );
  ep.people.forEach((p, i) => out.push({ path: `people[${i}].source`, source: p.source }));
  ep.stats.forEach((s, i) => out.push({ path: `stats[${i}].source`, source: s.source }));
  return out;
}

/** Every source is a paragraph that exists in both transcripts, or an official http(s) URL. */
export const sources: Check = (ctx) => {
  const messages: string[] = [];
  const official = (path: string, url: string) => {
    if (!/^https?:\/\//i.test(url) || !isOfficialUrl(url))
      messages.push(`${path}: ${url} is not an official (.gov.in / .nic.in) http(s) URL`);
  };
  for (const { path, source } of allSources(ctx.episode)) {
    if ('url' in source) official(`${path}.url`, source.url);
    else
      for (const lang of ['en', 'hi'] as const) {
        const n = source.para[lang];
        if (n < 1 || n > ctx.paras[lang].length)
          messages.push(
            `${path}.para.${lang}: paragraph ${n} is out of range (${lang} transcript has ${ctx.paras[lang].length})`,
          );
      }
  }
  official('sources.en', ctx.episode.sources.en);
  official('sources.hi', ctx.episode.sources.hi);
  for (const [id, s] of ctx.schemes) {
    official(`schemes/${id}.officialUrl`, s.officialUrl);
    if (s.detailSource) official(`schemes/${id}.detailSource.url`, s.detailSource.url);
  }
  return result('sources', 'error', messages);
};
