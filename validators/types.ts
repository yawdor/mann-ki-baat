import type { Episode, Scheme } from '../src/lib/schema';

export type CheckResult = {
  check: string;
  level: 'error' | 'warning';
  ok: boolean;
  messages: string[];
};

export type ValidationContext = {
  /** Repository root holding `content/` and `sources/`. */
  root: string;
  month: string;
  episode: Episode;
  schemes: Map<string, Scheme>;
  paras: { en: string[]; hi: string[] };
  previous?: Episode;
  fetch: typeof fetch;
};

export type Check = (ctx: ValidationContext) => CheckResult | Promise<CheckResult>;

export function result(check: string, level: 'error' | 'warning', messages: string[]): CheckResult {
  return { check, level, ok: messages.length === 0, messages };
}
