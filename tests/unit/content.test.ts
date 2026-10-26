import { describe, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEpisodes, loadSchemes, deriveCounts, buildTrends } from '../../src/lib/content';
import { LANG_META, t, localePath, pick, completeLangs, UI_KEYS } from '../../src/lib/i18n';
import { LANGS, MACHINE_LANGS, CATEGORIES } from '../../src/lib/schema';
import { isMostlyScript } from '../../src/lib/text';

const eps = () => loadEpisodes('tests/fixtures/episodes');
const schemes = () => loadSchemes('tests/fixtures/schemes');

describe('loaders', () => {
  test('episodes sorted newest first', () => {
    expect(eps().map((e) => e.episode)).toEqual([138, 137]);
  });
  test('schemes keyed by id', () => {
    expect([...schemes().keys()].sort()).toEqual(['pm-kisan', 'sample-mention']);
  });
  test('missing directory gives empty results', () => {
    expect(loadEpisodes('tests/fixtures/nope')).toEqual([]);
    expect(loadSchemes('tests/fixtures/nope').size).toBe(0);
  });
  test('invalid file throws naming the file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mkb-'));
    writeFileSync(join(dir, '2026-10.json'), JSON.stringify({ episode: 1 }));
    expect(() => loadEpisodes(dir)).toThrow(/2026-10\.json/);
  });
});

describe('deriveCounts', () => {
  test('2026-09 fixture', () => {
    const ep = eps().find((e) => e.episode === 138)!;
    expect(deriveCounts(ep, schemes())).toEqual({ topics: 4, schemes: 1, people: 1, states: 4 });
  });
  test('2026-08 fixture', () => {
    const ep = eps().find((e) => e.episode === 137)!;
    expect(deriveCounts(ep, schemes())).toEqual({ topics: 3, schemes: 0, people: 0, states: 0 });
  });
});

describe('buildTrends', () => {
  test('oldest to newest with per-category counts', () => {
    const tr = buildTrends(eps());
    expect(tr.months).toEqual(['2026-08', '2026-09']);
    const row = (c: string) => tr.rows.find((r) => r.category === c)!.values;
    expect(row('Environment')).toEqual([1, 1]);
    expect(row('Culture')).toEqual([1, 1]);
    expect(row('Health')).toEqual([1, 0]);
    expect(row('Schemes')).toEqual([0, 1]);
    expect(row('Youth')).toEqual([0, 1]);
    expect(tr.rows.map((r) => r.category)).toEqual([...CATEGORIES]);
  });
  test('lastN limits to newest episodes', () => {
    expect(buildTrends(eps(), 1).months).toEqual(['2026-09']);
  });
});

describe('localePath', () => {
  test('prefixes', () => {
    expect(localePath('hi', '/2026-10/')).toBe('/mann-ki-baat/hi/2026-10/');
    expect(localePath('en', '/2026-10/')).toBe('/mann-ki-baat/2026-10/');
    expect(localePath('en', '/')).toBe('/mann-ki-baat/');
  });
});

describe('i18n', () => {
  test('LANG_META native names', () => {
    expect(LANGS.map((l) => LANG_META[l].nativeName)).toEqual(
      ['English', 'हिंदी', 'ಕನ್ನಡ', 'தமிழ்', 'తెలుగు', 'বাংলা', 'मराठी'],
    );
    expect(LANG_META.kn.machine).toBe(true);
    expect(LANG_META.hi.machine).toBe(false);
    expect(LANG_META.ta.fonts.display).toBe('Baloo Thambi 2');
  });
  test('every key non-empty in all languages; non-en mostly in script', () => {
    for (const lang of LANGS)
      for (const key of UI_KEYS) {
        const v = t(lang, key);
        expect(v.trim().length, `${lang}.${key}`).toBeGreaterThan(0);
        if (lang !== 'en') expect(isMostlyScript(v, lang), `${lang}.${key}: ${v}`).toBe(true);
      }
  });
  test('exact English strings', () => {
    expect(t('en', 'machineNotice')).toBe('Machine-translated — check official links for exact eligibility.');
    expect(t('en', 'mapNote')).toBe('Map for illustration; boundaries as per Survey of India.');
  });
  test('pick falls back to en only for machine languages', () => {
    const b = { en: 'E', hi: 'H', kn: '' };
    expect(pick(b, 'hi')).toBe('H');
    expect(pick(b, 'kn')).toBe('E');
    expect(pick(b, 'ta')).toBe('E');
    expect(pick({ ...b, kn: 'K' }, 'kn')).toBe('K');
  });
  test('completeLangs: full kn, partial ta', () => {
    const ep = eps().find((e) => e.episode === 138)!;
    expect(completeLangs(ep, schemes())).toEqual(['en', 'hi', 'kn']);
    expect(MACHINE_LANGS).toContain('ta');
  });
});

describe('scheme file names and ids', () => {
  const pmKisan = () => JSON.parse(readFileSync('tests/fixtures/schemes/pm-kisan.json', 'utf8'));
  const dirWith = (files: Record<string, unknown>) => {
    const dir = mkdtempSync(join(tmpdir(), 'mkb-schemes-'));
    for (const [f, v] of Object.entries(files)) writeFileSync(join(dir, f), JSON.stringify(v));
    return dir;
  };

  test('loadSchemes throws on duplicate ids, naming both files', () => {
    expect(() => loadSchemes(dirWith({ 'pm-kisan.json': pmKisan(), 'pm-kisan-copy.json': pmKisan() }))).toThrow(
      /duplicate scheme id "pm-kisan".*pm-kisan-copy\.json.*pm-kisan\.json|duplicate scheme id "pm-kisan".*pm-kisan\.json.*pm-kisan-copy\.json/,
    );
  });

  test('loadSchemes throws when a file name is not <id>.json', () => {
    expect(() => loadSchemes(dirWith({ 'kisan.json': pmKisan() }))).toThrow(/kisan\.json.*must be named pm-kisan\.json/);
  });
});
