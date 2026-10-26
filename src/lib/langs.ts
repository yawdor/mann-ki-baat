import { MACHINE_LANGS, type Lang, type Scheme, type Episode } from './schema';
import { isMostlyScript } from './text';

export type LocalizedField = { path: string; value: Record<string, unknown> };

/** Every Localized-shaped object (string `en` and `hi` keys) under `node`, with its JSON path. */
export function collectLocalized(node: unknown, path: string, out: LocalizedField[] = []): LocalizedField[] {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectLocalized(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.en === 'string' || typeof o.hi === 'string') {
      out.push({ path, value: o });
    } else {
      for (const [k, v] of Object.entries(o)) {
        if (k === 'sources' || k === 'para') continue;
        collectLocalized(v, path ? `${path}.${k}` : k, out);
      }
    }
  }
  return out;
}

/** Schemes the episode links to (via topic.schemeIds) that exist in the map. */
export function referencedSchemes(ep: Episode, schemes: Map<string, Scheme>): Scheme[] {
  const ids = new Set(ep.topics.flatMap((t) => t.schemeIds));
  return [...ids].map((id) => schemes.get(id)).filter((s): s is Scheme => !!s);
}

/** Localized fields of the episode (machine-language completeness is judged on these). */
export function episodeFields(ep: Episode): LocalizedField[] {
  return collectLocalized(ep, '');
}

const present = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

export type LangProblems = {
  /** en/hi problems (errors) */
  base: string[];
  /** per machine language: partial / wrong-script problems (warnings) */
  machine: Partial<Record<Lang, string[]>>;
};

export function analyseLangs(ep: Episode, schemes: Map<string, Scheme>): LangProblems {
  const base: string[] = [];
  const machine: Partial<Record<Lang, string[]>> = {};
  const epFields = episodeFields(ep);
  const schemeFields = referencedSchemes(ep, schemes).flatMap((s) =>
    collectLocalized(s, `schemes/${s.id}`),
  );
  for (const f of [...epFields, ...schemeFields]) {
    if (!present(f.value.en)) base.push(`${f.path}.en is missing or empty`);
    if (!present(f.value.hi)) base.push(`${f.path}.hi is missing or empty`);
    else if (!isMostlyScript(f.value.hi as string, 'hi'))
      base.push(`${f.path}.hi is not mostly Devanagari`);
  }
  // Machine languages are judged on the episode's own fields; scheme pages fall back to English.
  for (const lang of MACHINE_LANGS) {
    const problems: string[] = [];
    const missing: string[] = [];
    let any = false;
    for (const f of epFields) {
      const v = f.value[lang];
      if (v === undefined) missing.push(f.path);
      else {
        any = true;
        if (!present(v)) missing.push(f.path);
        else if (!isMostlyScript(v as string, lang)) problems.push(`${f.path}.${lang} is not mostly ${lang} script`);
      }
    }
    if (!any) continue;
    for (const p of missing) problems.push(`${p}.${lang} is missing`);
    if (problems.length) machine[lang] = problems;
  }
  return { base, machine };
}

/** en, hi (when valid) first, then complete machine languages in MACHINE_LANGS order. */
export function completeLangs(ep: Episode, schemes: Map<string, Scheme>): Lang[] {
  const { base, machine } = analyseLangs(ep, schemes);
  const out: Lang[] = [];
  if (!base.length) out.push('en', 'hi');
  const epFields = episodeFields(ep);
  for (const lang of MACHINE_LANGS) {
    if (machine[lang]) continue;
    if (epFields.some((f) => f.value[lang] !== undefined)) out.push(lang);
  }
  return out;
}
