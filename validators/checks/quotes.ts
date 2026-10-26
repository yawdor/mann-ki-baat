import { normalizeText } from '../../src/lib/text';
import { result, type Check } from '../types';

/** Each quote must appear verbatim (after normalisation) in the cited paragraph of the en and hi transcripts. */
export const quotes: Check = (ctx) => {
  const messages: string[] = [];
  ctx.episode.topics.forEach((t, i) => {
    const q = t.quote;
    if (!q) return;
    for (const lang of ['en', 'hi'] as const) {
      const field = `topics[${i}].quote.text.${lang}`;
      const n = q.para[lang];
      const para = ctx.paras[lang][n - 1];
      if (para === undefined) {
        messages.push(
          `${field}: paragraph ${n} does not exist in the ${lang} transcript (${ctx.paras[lang].length} paragraphs)`,
        );
        continue;
      }
      const needle = normalizeText(q.text[lang]);
      if (!needle || !normalizeText(para).includes(needle))
        messages.push(`${field}: quote not found verbatim in ${lang} transcript paragraph ${n}`);
    }
  });
  return result('quotes', 'error', messages);
};
