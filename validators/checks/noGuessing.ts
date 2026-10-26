import { isOfficialUrl } from '../../src/lib/schema';
import { result, type Check } from '../types';

/** A `full` scheme needs eligibility, steps, documents, checkedAt and an official detailSource. */
export const noGuessing: Check = (ctx) => {
  const messages: string[] = [];
  for (const [id, s] of ctx.schemes) {
    if (s.detailLevel !== 'full') continue;
    const p = `schemes/${id}`;
    if (!s.eligibility?.length) messages.push(`${p}.eligibility: required for a full scheme`);
    if (!s.steps?.length) messages.push(`${p}.steps: required for a full scheme`);
    if (!s.documents?.length) messages.push(`${p}.documents: required for a full scheme`);
    if (!s.checkedAt) messages.push(`${p}.checkedAt: required for a full scheme`);
    if (!s.detailSource || !isOfficialUrl(s.detailSource.url))
      messages.push(`${p}.detailSource: official (.gov.in / .nic.in) source required for a full scheme`);
  }
  return result('noGuessing', 'error', messages);
};
