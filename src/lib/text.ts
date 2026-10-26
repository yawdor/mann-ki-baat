import type { Lang } from './schema';

/** NFC, straight quotes, "-" for en/em dashes, collapsed whitespace (incl. NBSP), trimmed. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

const RANGES: Partial<Record<Lang, [number, number]>> = {
  hi: [0x0900, 0x097f],
  mr: [0x0900, 0x097f],
  bn: [0x0980, 0x09ff],
  ta: [0x0b80, 0x0bff],
  te: [0x0c00, 0x0c7f],
  kn: [0x0c80, 0x0cff],
};

/** True when at least 60% of letters (including combining vowel signs) are in the language's script block. */
export function isMostlyScript(s: string, lang: Lang): boolean {
  const range = RANGES[lang];
  if (!range) return true;
  let letters = 0;
  let inBlock = 0;
  for (const ch of s) {
    if (!/[\p{L}\p{M}]/u.test(ch)) continue;
    letters++;
    const cp = ch.codePointAt(0)!;
    if (cp >= range[0] && cp <= range[1]) inBlock++;
  }
  return letters === 0 ? true : inBlock / letters >= 0.6;
}
