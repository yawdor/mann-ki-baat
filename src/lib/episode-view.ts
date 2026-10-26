import { pick, t, type UiKey } from './i18n';
import type { Category, Lang, Scheme } from './schema';

type Audience = 'farmers' | 'women' | 'students' | 'senior-citizens' | 'households' | 'youth' | 'health' | 'business' | 'workers' | 'children';

/** Band colours for topic cards (canvas Main board); white text sits on a darkened pill. */
export const CATEGORY_COLOURS: Record<Category, string> = {
  Schemes: '#E08A00',
  Environment: 'var(--mehendi)',
  Culture: 'var(--gulabi)',
  People: 'var(--peacock)',
  Youth: '#E2580E',
  Health: 'var(--kumkum)',
  Science: '#3E5C76',
  Other: '#6B4A2E',
};

/** Audience chip colours (white text, AA contrast). */
export const AUDIENCE_COLOURS: Record<Audience, string> = {
  farmers: 'var(--mehendi)',
  women: 'var(--gulabi)',
  students: 'var(--peacock)',
  'senior-citizens': 'var(--kumkum)',
  households: '#A44A00',
  youth: '#B34700',
  health: '#8E1238',
  business: '#2F5D7C',
  workers: '#5A3A22',
  children: '#9A1A55',
};

/** Arch backgrounds that rotate across people and scheme icons. */
export const ROTATING = ['var(--mehendi)', '#E2580E', 'var(--peacock)', 'var(--gulabi)', 'var(--kumkum)'];

export const categoryLabel = (lang: Lang, c: Category) => t(lang, `cat${c}` as UiKey);

export const audienceLabel = (lang: Lang, a: string) =>
  t(lang, `aud${a.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}` as UiKey);

const locale = (lang: Lang) => `${lang}-IN`;

/** e.g. "Sunday, 27 September 2026" (localized, UTC so the ISO date never shifts). */
export function longDate(iso: string, lang: Lang, weekday = false): string {
  return new Intl.DateTimeFormat(locale(lang), {
    ...(weekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

export const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');

/** First grapheme (so Indic conjuncts/matras stay whole). */
export function initial(s: string): string {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s.trim());
  for (const { segment } of seg) return segment;
  return '';
}

/** Lower-case haystack for the scheme search box (src/scripts/schemes.ts): names, one-liners, audiences, states. */
export const schemeSearchText = (s: Scheme, lang: Lang) =>
  [
    s.name.en, s.name.hi, pick(s.name, lang), s.gives.en, s.gives.hi, pick(s.gives, lang),
    ...s.audiences.flatMap((a) => [a, audienceLabel('en', a), audienceLabel(lang, a)]),
    ...s.states,
  ].join(' ').toLowerCase();
