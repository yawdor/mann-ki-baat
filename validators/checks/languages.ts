import { analyseLangs } from '../../src/lib/langs';
import { result, type Check } from '../types';

/** en/hi must be present on every field and hi mostly Devanagari (errors). */
export const languages: Check = (ctx) =>
  result('languages', 'error', analyseLangs(ctx.episode, ctx.schemes).base);

/** Partial or wrong-script machine languages are warnings; that language is dropped from completeLangs. */
export const machineLanguages: Check = (ctx) => {
  const { machine } = analyseLangs(ctx.episode, ctx.schemes);
  const messages = Object.entries(machine).flatMap(([lang, ms]) =>
    (ms ?? []).map((m) => `${m} (${lang} excluded)`),
  );
  return result('languages.machine', 'warning', messages);
};
