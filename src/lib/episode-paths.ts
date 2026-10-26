import { completeLangs, loadEpisodes, loadSchemes } from './content';
import { localePath, pick } from './i18n';
import type { Episode, Lang, Scheme } from './schema';

export type EpisodeLink = { month: string; title: string; href: string; lang: Lang };

export type EpisodePageProps = {
  episode: Episode;
  schemes: Map<string, Scheme>;
  lang: Lang;
  /** Older episode. */
  prev?: EpisodeLink;
  /** Newer episode. */
  next?: EpisodeLink;
};

export const monthOf = (ep: Episode) => ep.date.slice(0, 7);

/** Link to a neighbouring episode in `lang`, or in English when it lacks that language. */
function link(ep: Episode | undefined, lang: Lang, schemes: Map<string, Scheme>): EpisodeLink | undefined {
  if (!ep) return undefined;
  const l: Lang = lang === 'en' || completeLangs(ep, schemes).includes(lang) ? lang : 'en';
  return { month: monthOf(ep), title: pick(ep.title, l), href: localePath(l, `/${monthOf(ep)}/`), lang: l };
}

/** `eps` newest first (as `loadEpisodes` returns them). */
function props(eps: Episode[], i: number, lang: Lang, schemes: Map<string, Scheme>): EpisodePageProps {
  return {
    episode: eps[i],
    schemes,
    lang,
    prev: link(eps[i + 1], lang, schemes),
    next: link(eps[i - 1], lang, schemes),
  };
}

/** Paths for `src/pages/[month].astro` (English): one per episode. */
export function enPaths(eps = loadEpisodes(), schemes = loadSchemes()) {
  return eps.map((ep, i) => ({ params: { month: monthOf(ep) }, props: props(eps, i, 'en', schemes) }));
}

/** Paths for `src/pages/[lang]/[month].astro`: every non-en language complete for that episode. */
export function langPaths(eps = loadEpisodes(), schemes = loadSchemes()) {
  return eps.flatMap((ep, i) =>
    completeLangs(ep, schemes)
      .filter((l) => l !== 'en')
      .map((lang) => ({ params: { lang, month: monthOf(ep) }, props: props(eps, i, lang, schemes) })),
  );
}
