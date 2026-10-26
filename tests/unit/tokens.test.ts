import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import tokens from '../../design/tokens.json';
import { generateCss } from '../../scripts/tokens-to-css';
import { googleFontsHref } from '../../src/lib/fonts';
import { LANGS } from '../../src/lib/schema';

const PALETTE = {
  kumkum: '#7A1431',
  haldi: '#F2B705',
  marigold: '#F07F13',
  peacock: '#0B4F6C',
  gulabi: '#B0124A',
  chandan: '#FFF3D1',
  text: '#2A1205',
  white: '#FFFFFF',
} as const;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
const hex = (name: string) => (tokens.color as Record<string, { value: string }>)[name]!.value;

describe('generated CSS', () => {
  const css = generateCss(tokens);
  it('contains every palette variable with its exact hex (mehendi checked against tokens.json)', () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      expect(css).toContain(`--${name}: ${value};`);
    }
    expect(css).toContain(`--mehendi: ${hex('mehendi')};`);
  });
  it('exposes font, radius and spacing variables', () => {
    expect(css).toContain("--font-display: 'Rozha One', serif;");
    expect(css).toContain("--font-body: 'Mukta', system-ui, sans-serif;");
    expect(css).toContain('--radius-card: 22px;');
    expect(css).toContain('--radius-arch: 999px 999px 18px 18px;');
    expect(css).toContain('--space-section: 88px;');
  });
  it('has per-language font overrides', () => {
    expect(css).toMatch(/:lang\(kn\)\s*\{[^}]*Baloo Tamma 2[^}]*Noto Sans Kannada/);
    expect(css).toMatch(/:lang\(ta\)\s*\{[^}]*Baloo Thambi 2[^}]*Noto Sans Tamil/);
    expect(css).toMatch(/:lang\(te\)\s*\{[^}]*Baloo Tammudu 2[^}]*Noto Sans Telugu/);
    expect(css).toMatch(/:lang\(bn\)\s*\{[^}]*Baloo Da 2[^}]*Noto Sans Bengali/);
  });
  it('committed src/styles/tokens.css equals a fresh generation', () => {
    expect(readFileSync('src/styles/tokens.css', 'utf8')).toBe(css);
  });
});

describe('WCAG contrast', () => {
  const pairs: [string, string, string][] = [
    ['text', 'white', 'text on white'],
    ['text', 'chandan', 'text on chandan'],
    ['text', 'haldi', 'text on haldi'],
    ['white', 'kumkum', 'white on kumkum'],
    ['white', 'peacock', 'white on peacock'],
    ['white', 'mehendi', 'white on mehendi'],
    ['white', 'gulabi', 'white on gulabi'],
  ];
  it.each(pairs)('%s on %s >= 4.5 (%s)', (fg, bg) => {
    expect(contrast(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it('marigold and haldi are not text colours', () => {
    expect(tokens.color.marigold.usage).toBe('decorative');
    expect(['decorative', 'surface']).toContain(tokens.color.haldi.usage);
  });
});

describe('googleFontsHref', () => {
  it('en loads only Rozha One and Mukta with display=swap', () => {
    const href = googleFontsHref('en');
    expect(href).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/);
    expect(href).toContain('family=Rozha+One');
    expect(href).toContain('family=Mukta:wght@400;500;600;700');
    expect(href).toContain('display=swap');
    expect(href).not.toContain('Baloo');
  });
  it('hi and mr use the Devanagari pair', () => {
    expect(googleFontsHref('hi')).toBe(googleFontsHref('en'));
    expect(googleFontsHref('mr')).toBe(googleFontsHref('en'));
  });
  it('regional languages load their own families', () => {
    expect(googleFontsHref('kn')).toContain('family=Baloo+Tamma+2');
    expect(googleFontsHref('kn')).toContain('family=Noto+Sans+Kannada');
    expect(googleFontsHref('ta')).toContain('family=Baloo+Thambi+2');
    expect(googleFontsHref('te')).toContain('family=Noto+Sans+Telugu');
    expect(googleFontsHref('bn')).toContain('family=Baloo+Da+2');
    expect(googleFontsHref('kn')).not.toContain('Rozha');
  });
  it('every lang yields an href', () => {
    for (const l of LANGS) expect(googleFontsHref(l)).toContain('display=swap');
  });
});
