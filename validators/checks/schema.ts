import { EpisodeSchema, SchemeSchema } from '../../src/lib/schema';
import { result, type CheckResult } from '../types';

const fmt = (issues: { path: PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);

/** Schema validation of raw JSON. Runs before the typed checks (which need parsed data). */
export function schemaCheck(rawEpisode: unknown, rawSchemes: Map<string, unknown>): CheckResult {
  const messages: string[] = [];
  const ep = EpisodeSchema.safeParse(rawEpisode);
  if (!ep.success) messages.push(...fmt(ep.error.issues).map((m) => `episode ${m}`));
  for (const [file, raw] of rawSchemes) {
    const s = SchemeSchema.safeParse(raw);
    if (!s.success) messages.push(...fmt(s.error.issues).map((m) => `scheme ${file} ${m}`));
  }
  return result('schema', 'error', messages);
}
