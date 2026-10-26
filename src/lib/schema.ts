import { z } from 'zod';

export const LANGS = ['en', 'hi', 'kn', 'ta', 'te', 'bn', 'mr'] as const;
export const MACHINE_LANGS = ['kn', 'ta', 'te', 'bn', 'mr'] as const;
export type Lang = (typeof LANGS)[number];

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const CATEGORIES = [
  'Schemes', 'Environment', 'Culture', 'People', 'Youth', 'Health', 'Science', 'Other',
] as const;
export const ACCENTS = ['#7A1431', '#F2B705', '#0B4F6C', '#12915A', '#B0124A', '#F07F13'] as const;
export const MOTIFS = ['lotus', 'diya', 'peacock', 'wheat', 'wheel', 'mandala'] as const;
export const AUDIENCES = [
  'farmers', 'women', 'students', 'senior-citizens', 'households',
  'youth', 'health', 'business', 'workers', 'children',
] as const;

/** True for http(s) URLs whose host is on an official domain (.gov.in / .nic.in). */
export function isOfficialUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    return h.endsWith('.gov.in') || h.endsWith('.nic.in');
  } catch {
    return false;
  }
}

const text = z.string().min(1);
const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case');
const month = z.string().regex(MONTH_RE);

export const LocalizedSchema = z.object({
  en: text,
  hi: text,
  kn: text.optional(),
  ta: text.optional(),
  te: text.optional(),
  bn: text.optional(),
  mr: text.optional(),
});
export type Localized = z.infer<typeof LocalizedSchema>;

export const SourceSchema = z.union([
  z.object({ transcript: z.enum(['en', 'hi']), para: z.number().int().min(1) }),
  z.object({ url: z.url() }),
]);
export type Source = z.infer<typeof SourceSchema>;

export const FactSchema = z.object({ text: LocalizedSchema, source: SourceSchema });
export type Fact = z.infer<typeof FactSchema>;

/** Verbatim quote; `para` is the 1-based paragraph in the transcript. */
export const QuoteSchema = z.object({ text: LocalizedSchema, para: z.number().int().min(1) });

export const TopicSchema = z.object({
  id,
  title: LocalizedSchema,
  category: z.enum(CATEGORIES),
  explainer: LocalizedSchema,
  facts: z.array(FactSchema),
  quote: QuoteSchema.optional(),
  schemeIds: z.array(id),
  placeIds: z.array(id),
  personIds: z.array(id),
});
export type Topic = z.infer<typeof TopicSchema>;

export const PersonSchema = z.object({
  id,
  name: LocalizedSchema,
  place: LocalizedSchema,
  story: LocalizedSchema,
  topicId: id,
  source: SourceSchema,
});
export type Person = z.infer<typeof PersonSchema>;

export const PlaceSchema = z.object({
  id,
  name: LocalizedSchema,
  /** English state / UT name (plain string: used as the map join key). */
  state: text,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  topicId: id,
});
export type Place = z.infer<typeof PlaceSchema>;

export const StatSchema = z.object({
  value: text,
  label: LocalizedSchema,
  context: LocalizedSchema,
  source: SourceSchema,
});
export type Stat = z.infer<typeof StatSchema>;

export const EpisodeSchema = z.object({
  episode: z.number().int().positive(),
  date: z.iso.date(),
  title: LocalizedSchema,
  summary: LocalizedSchema,
  theme: z.object({ accent: z.enum(ACCENTS), motif: z.enum(MOTIFS) }),
  sources: z.object({ en: z.url(), hi: z.url() }),
  topics: z.array(TopicSchema),
  people: z.array(PersonSchema),
  places: z.array(PlaceSchema),
  stats: z.array(StatSchema),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const SchemeSchema = z
  .object({
    id,
    name: LocalizedSchema,
    gives: LocalizedSchema,
    eligibility: z.array(LocalizedSchema).default([]),
    steps: z.array(LocalizedSchema).default([]),
    documents: z.array(LocalizedSchema).default([]),
    officialUrl: z.url().refine(isOfficialUrl, 'must be on .gov.in / .nic.in'),
    helpline: z.string().min(1).optional(),
    audiences: z.array(z.enum(AUDIENCES)),
    /** `["all"]` or a list of state names. */
    states: z.array(text).min(1),
    checkedAt: z.iso.date().optional(),
    mentions: z.array(month).default([]),
    detailLevel: z.enum(['full', 'mention-only']),
    detailSource: z.object({ url: z.url() }).optional(),
  })
  .superRefine((s, ctx) => {
    if (s.detailLevel !== 'full') return;
    const need = (path: string, msg: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message: msg });
    if (!s.eligibility.length) need('eligibility', 'full scheme requires eligibility');
    if (!s.steps.length) need('steps', 'full scheme requires steps');
    if (!s.documents.length) need('documents', 'full scheme requires documents');
    if (!s.checkedAt) need('checkedAt', 'full scheme requires checkedAt');
    if (!s.detailSource || !isOfficialUrl(s.detailSource.url))
      need('detailSource', 'full scheme requires detailSource on an official domain');
  });
export type Scheme = z.infer<typeof SchemeSchema>;
