import { completeLangs, loadEpisodes, loadSchemes } from './content';
import { LANG_META, localePath, pick } from './i18n';
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
  /** Language of the home/archive link: `lang` when that home page exists, else English. */
  homeLang?: Lang;
};

export const monthOf = (ep: Episode) => ep.date.slice(0, 7);

/**
 * Languages with a home and scheme-index page: en, hi always, plus each machine
 * language complete for the latest episode. `eps` newest first.
 */
export function homeLangs(eps: Episode[], schemes: Map<string, Scheme>): Lang[] {
  const machine = eps.length ? completeLangs(eps[0], schemes).filter((l) => LANG_META[l].machine) : [];
  return ['en', 'hi', ...machine];
}

/** Link to an episode in `lang`, or in English when it lacks that language. */
export function episodeLink(ep: Episode, lang: Lang, schemes: Map<string, Scheme>): EpisodeLink {
  const l: Lang = lang === 'en' || completeLangs(ep, schemes).includes(lang) ? lang : 'en';
  return { month: monthOf(ep), title: pick(ep.title, l), href: localePath(l, `/${monthOf(ep)}/`), lang: l };
}

/** `eps` newest first (as `loadEpisodes` returns them). */
function props(eps: Episode[], i: number, lang: Lang, schemes: Map<string, Scheme>, homes: Lang[]): EpisodePageProps {
  const link = (ep?: Episode) => (ep ? episodeLink(ep, lang, schemes) : undefined);
  return {
    episode: eps[i],
    schemes,
    lang,
    prev: link(eps[i + 1]),
    next: link(eps[i - 1]),
    homeLang: homes.includes(lang) ? lang : 'en',
  };
}

/** Paths for `src/pages/[month].astro` (English): one per episode. */
export function enPaths(eps = loadEpisodes(), schemes = loadSchemes()) {
  const homes = homeLangs(eps, schemes);
  return eps.map((ep, i) => ({ params: { month: monthOf(ep) }, props: props(eps, i, 'en', schemes, homes) }));
}

/** Paths for `src/pages/[lang]/[month].astro`: every non-en language complete for that episode. */
export function langPaths(eps = loadEpisodes(), schemes = loadSchemes()) {
  const homes = homeLangs(eps, schemes);
  return eps.flatMap((ep, i) =>
    completeLangs(ep, schemes)
      .filter((l) => l !== 'en')
      .map((lang) => ({ params: { lang, month: monthOf(ep) }, props: props(eps, i, lang, schemes, homes) })),
  );
}
