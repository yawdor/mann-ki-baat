import { result, type Check } from '../types';

const dup = (path: string, ids: string[], out: string[]) => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) out.push(`${path}: duplicate id "${id}"`);
    seen.add(id);
  }
};

export const sanity: Check = (ctx) => {
  const ep = ctx.episode;
  const m: string[] = [];
  if (ep.topics.length < 3 || ep.topics.length > 25)
    m.push(`topics: ${ep.topics.length} topics, expected 3 to 25`);
  if (ctx.previous && ep.episode <= ctx.previous.episode)
    m.push(`episode: ${ep.episode} must be greater than previous episode ${ctx.previous.episode}`);
  if (!ep.date.startsWith(`${ctx.month}-`)) m.push(`date: ${ep.date} is not in ${ctx.month}`);

  dup('topics', ep.topics.map((t) => t.id), m);
  dup('people', ep.people.map((t) => t.id), m);
  dup('places', ep.places.map((t) => t.id), m);

  const topicIds = new Set(ep.topics.map((t) => t.id));
  const personIds = new Set(ep.people.map((p) => p.id));
  const placeIds = new Set(ep.places.map((p) => p.id));
  ep.topics.forEach((t, i) => {
    t.personIds.forEach((id) => personIds.has(id) || m.push(`topics[${i}].personIds: unknown person "${id}"`));
    t.placeIds.forEach((id) => placeIds.has(id) || m.push(`topics[${i}].placeIds: unknown place "${id}"`));
    t.schemeIds.forEach((id) => ctx.schemes.has(id) || m.push(`topics[${i}].schemeIds: unknown scheme "${id}"`));
  });
  ep.people.forEach((p, i) => topicIds.has(p.topicId) || m.push(`people[${i}].topicId: unknown topic "${p.topicId}"`));
  ep.places.forEach((p, i) => topicIds.has(p.topicId) || m.push(`places[${i}].topicId: unknown topic "${p.topicId}"`));
  return result('sanity', 'error', m);
};

/** Broadcasts occasionally move, so a non-last-Sunday date is only a warning. */
export const lastSunday: Check = (ctx) => {
  const [y, mo] = ctx.episode.date.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo, 0)); // last day of the month
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const expected = d.toISOString().slice(0, 10);
  return result(
    'sanity.lastSunday',
    'warning',
    ctx.episode.date === expected
      ? []
      : [`date: ${ctx.episode.date} is not the last Sunday of the month (${expected})`],
  );
};
