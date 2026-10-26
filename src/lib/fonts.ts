import type { Lang } from './schema';

const DEVANAGARI = ['Rozha+One', 'Mukta:wght@400;500;600;700'];

const FAMILIES: Record<Lang, string[]> = {
  en: DEVANAGARI,
  hi: DEVANAGARI,
  mr: DEVANAGARI,
  kn: ['Baloo+Tamma+2:wght@400;700', 'Noto+Sans+Kannada:wght@400;500;600;700'],
  ta: ['Baloo+Thambi+2:wght@400;700', 'Noto+Sans+Tamil:wght@400;500;600;700'],
  te: ['Baloo+Tammudu+2:wght@400;700', 'Noto+Sans+Telugu:wght@400;500;600;700'],
  bn: ['Baloo+Da+2:wght@400;700', 'Noto+Sans+Bengali:wght@400;500;600;700'],
};

/** Google Fonts css2 URL with only the families this language needs. */
export function googleFontsHref(lang: Lang): string {
  return `https://fonts.googleapis.com/css2?${FAMILIES[lang].map((f) => `family=${f}`).join('&')}&display=swap`;
}

const plain = (f: string) => f.split(':')[0].replace(/\+/g, ' ');

/** Display and body family names (without weights) for a language. */
export function fontFamilyNames(lang: Lang): { display: string; body: string } {
  const [display, body] = FAMILIES[lang];
  return { display: plain(display), body: plain(body) };
}
