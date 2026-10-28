import { result, type Check } from '../types';

/** Each quiz question cites a transcript paragraph that exists in both languages and has an explanation. */
export const quiz: Check = (ctx) => {
  const messages: string[] = [];
  (ctx.episode.quiz ?? []).forEach((q, i) => {
    for (const lang of ['en', 'hi'] as const) {
      const n = q.source.para[lang];
      if (ctx.paras[lang][n - 1] === undefined)
        messages.push(
          `quiz[${i}].source.para.${lang}: paragraph ${n} does not exist in the ${lang} transcript (${ctx.paras[lang].length} paragraphs)`,
        );
      if (!q.explanation[lang].trim()) messages.push(`quiz[${i}].explanation.${lang}: empty`);
    }
  });
  return result('quiz', 'error', messages);
};
