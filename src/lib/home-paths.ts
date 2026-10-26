import { buildTrends, deriveCounts, loadEpisodes, loadSchemes } from './content';
import { episodeLink, homeLangs, monthOf, type EpisodeLink } from './episode-paths';
import { audienceLabel, categoryLabel, CATEGORY_COLOURS, host } from './episode-view';
import { localePath, pick, t, type Lang } from './i18n';
import { referencedSchemes } from './langs';
import type { Category, Episode, Localized, Scheme } from './schema';

export { homeLangs } from './episode-paths';

/** Props for the home page and the scheme-index page (one set per language). */
export type HomePageProps = {
  lang: Lang;
  /** Newest first. */
  episodes: Episode[];
  schemes: Map<string, Scheme>;
  /** Languages that have a home / scheme-index page (hreflang + language menu). */
  langs: Lang[];
};

export function homeProps(lang: Lang, eps = loadEpisodes(), schemes = loadSchemes()): HomePageProps {
  return { lang, episodes: eps, schemes, langs: homeLangs(eps, schemes) };
}

/** Paths for `src/pages/[lang]/index.astro` and `src/pages/[lang]/schemes.astro`. */
export function homePaths(eps = loadEpisodes(), schemes = loadSchemes()) {
  return homeLangs(eps, schemes)
    .filter((l) => l !== 'en')
    .map((lang) => ({ params: { lang }, props: homeProps(lang, eps, schemes) }));
}

const locale = (lang: Lang) => `${lang}-IN`;
const monthDate = (month: string) => new Date(`${month}-01T00:00:00Z`);

/** Localized month name, e.g. "Sep" / "September 2026". */
export function monthName(month: string, lang: Lang, style: 'short' | 'long' | 'label'): string {
  const opts: Intl.DateTimeFormatOptions =
    style === 'short' ? { month: 'short' } : style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(locale(lang), { ...opts, timeZone: 'UTC' }).format(monthDate(month));
}

/** Haldi and marigold need dark text; the other accents carry white. */
const LIGHT_ACCENTS = new Set(['#F2B705', '#F07F13']);
export const onAccent = (accent: string) => (LIGHT_ACCENTS.has(accent.toUpperCase()) ? 'var(--text)' : 'var(--white)');

/** True when `pick(b, lang)` returns the English fallback for a machine language. */
const fallsBack = (b: Localized, lang: Lang) => lang !== 'en' && lang !== 'hi' && !(typeof b[lang] === 'string' && b[lang]!.trim());

export type ArchiveCard = {
  month: string;
  link: EpisodeLink;
  title: string;
  /** Set when a machine language falls back to the English headline. */
  titleLang?: Lang;
  accent: string;
  ink: string;
  short: string;
  label: string;
  counts: ReturnType<typeof deriveCounts>;
};

export function archiveCards(eps: Episode[], schemes: Map<string, Scheme>, lang: Lang): ArchiveCard[] {
  return eps.map((ep) => ({
    month: monthOf(ep),
    link: episodeLink(ep, lang, schemes),
    title: pick(ep.title, lang),
    titleLang: fallsBack(ep.title, lang) ? 'en' : undefined,
    accent: ep.theme.accent,
    ink: onAccent(ep.theme.accent),
    short: monthName(monthOf(ep), lang, 'short'),
    label: monthName(monthOf(ep), lang, 'long'),
    counts: deriveCounts(ep, schemes),
  }));
}

export const FLOWER_MIN = 10;
export const FLOWER_MAX = 42;

/** Circle diameter in px: 0 for no topics, else 10 px → 42 px in proportion to `max`. */
export function flowerSize(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.round(FLOWER_MIN + (FLOWER_MAX - FLOWER_MIN) * (Math.min(value, max) / max));
}

export type TrendView = {
  months: { month: string; short: string; label: string }[];
  rows: { category: Category; label: string; colour: string; cells: { value: number; size: number }[] }[];
  summary: string;
};

/** Trend grid for the last `lastN` episodes; null with fewer than 2 episodes. Rows with no topics are dropped. */
export function trendView(eps: Episode[], lang: Lang, summaryLabel: string, lastN = 6): TrendView | null {
  if (eps.length < 2) return null;
  const tr = buildTrends(eps, lastN);
  const max = Math.max(0, ...tr.rows.flatMap((r) => r.values));
  const months = tr.months.map((m) => ({ month: m, short: monthName(m, lang, 'short'), label: monthName(m, lang, 'label') }));
  const rows = tr.rows
    .filter((r) => r.values.some((v) => v > 0))
    .map((r) => ({
      category: r.category,
      label: categoryLabel(lang, r.category),
      colour: CATEGORY_COLOURS[r.category],
      cells: r.values.map((value) => ({ value, size: flowerSize(value, max) })),
    }));
  const summary = `${summaryLabel} (${months[0].label} – ${months[months.length - 1].label}): ${rows
    .map((r) => `${r.label} ${r.cells.map((c) => c.value).join(', ')}`)
    .join('; ')}`;
  return { months, rows, summary };
}

export type SchemeRow = {
  scheme: Scheme;
  name: string;
  /** True when a machine language falls back to the English name. */
  nameInEnglish: boolean;
  audiences: string[];
  mentions: { month: string; label: string; href?: string; hreflang?: Lang }[];
  officialHost: string;
};

/** Every scheme, alphabetical, with the months it was mentioned (linked when that episode exists). */
export function schemeRows(eps: Episode[], schemes: Map<string, Scheme>, lang: Lang): SchemeRow[] {
  const byMonth = new Map(eps.map((ep) => [monthOf(ep), ep]));
  return [...schemes.values()]
    .map((s) => {
      const referencing = eps.filter((ep) => referencedSchemes(ep, schemes).some((x) => x.id === s.id)).map(monthOf);
      const months = [...new Set([...s.mentions, ...referencing])].sort().reverse();
      return {
        scheme: s,
        name: pick(s.name, lang),
        nameInEnglish: fallsBack(s.name, lang),
        audiences: s.audiences.map((a) => audienceLabel(lang, a)),
        mentions: months.map((m) => {
          const ep = byMonth.get(m);
          if (!ep) return { month: m, label: monthName(m, lang, 'label') };
          const link = episodeLink(ep, lang, schemes);
          const anchor = referencing.includes(m) ? `#scheme-${s.id}` : '';
          return { month: m, label: monthName(m, lang, 'label'), href: link.href + anchor, hreflang: link.lang };
        }),
        officialHost: host(s.officialUrl),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale(lang)));
}

export type NavItem = { href: string; label: string; current?: boolean };

/** Header links for the home and scheme-index pages. */
export function siteNav(p: HomePageProps, page: 'home' | 'schemes', hasTrends: boolean): NavItem[] {
  const home = page === 'home' ? '' : localePath(p.lang, '/');
  const latest = p.episodes[0];
  return [
    ...(latest ? [{ href: episodeLink(latest, p.lang, p.schemes).href, label: t(p.lang, 'navLatest') }] : []),
    ...(latest ? [{ href: `${home}#archive`, label: t(p.lang, 'navAll') }] : []),
    ...(hasTrends ? [{ href: `${home}#trends`, label: t(p.lang, 'navTrends') }] : []),
    { href: localePath(p.lang, '/schemes/'), label: t(p.lang, 'navSchemeIndex'), current: page === 'schemes' },
  ];
}
