import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  EpisodeSchema,
  SchemeSchema,
  isOfficialUrl,
  MONTH_RE,
} from '../../src/lib/schema';

const load = (p: string) => JSON.parse(readFileSync(`tests/fixtures/${p}`, 'utf8'));

describe('schema', () => {
  test('parses valid episode fixture', () => {
    const ep = EpisodeSchema.parse(load('episodes/2026-09.json'));
    expect(ep.episode).toBe(138);
    expect(EpisodeSchema.safeParse(load('episodes/2026-08.json')).success).toBe(true);
  });

  test('rejects month "2026-13"', () => {
    expect(MONTH_RE.test('2026-13')).toBe(false);
    expect(MONTH_RE.test('2026-09')).toBe(true);
    const s = load('schemes/pm-kisan.json');
    s.mentions = ['2026-13'];
    expect(SchemeSchema.safeParse(s).success).toBe(false);
  });

  test('rejects Localized missing hi', () => {
    const ep = load('episodes/2026-09.json');
    delete ep.title.hi;
    expect(EpisodeSchema.safeParse(ep).success).toBe(false);
  });

  test('accepts Localized with optional kn and without ta', () => {
    const ep = load('episodes/2026-09.json');
    ep.title = { en: 'A', hi: 'ए', kn: 'ಎ' };
    expect(EpisodeSchema.safeParse(ep).success).toBe(true);
  });

  test('rejects fact without source', () => {
    const ep = load('episodes/2026-09.json');
    delete ep.topics[0].facts[0].source;
    expect(EpisodeSchema.safeParse(ep).success).toBe(false);
  });

  test('rejects full scheme without checkedAt', () => {
    const s = load('schemes/pm-kisan.json');
    expect(SchemeSchema.safeParse(s).success).toBe(true);
    delete s.checkedAt;
    expect(SchemeSchema.safeParse(s).success).toBe(false);
  });

  test('accepts mention-only scheme without eligibility', () => {
    const s = load('schemes/sample-mention.json');
    expect(s.eligibility).toBeUndefined();
    expect(SchemeSchema.safeParse(s).success).toBe(true);
  });

  test('full scheme needs an official detailSource', () => {
    const s = load('schemes/pm-kisan.json');
    s.detailSource = { url: 'https://example.com/x' };
    expect(SchemeSchema.safeParse(s).success).toBe(false);
    expect(isOfficialUrl('https://pmkisan.gov.in/')).toBe(true);
    expect(isOfficialUrl('https://evil-gov.in.example.com/')).toBe(false);
    expect(isOfficialUrl('not a url')).toBe(false);
  });
});
