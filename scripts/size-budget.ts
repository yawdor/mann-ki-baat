// Fails if an episode page's HTML + local CSS + local JS exceeds 300 KB *transferred* (gzip, as GitHub Pages serves it;
// global-constraints: "transferred excluding fonts"). Fonts and external URLs are excluded. Raw sizes are shown too.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'node-html-parser';

const BUDGET = 300 * 1024;
const BASE = '/mann-ki-baat/';
const dist = resolve(process.argv[2] ?? 'dist');
if (!existsSync(dist)) {
  console.error(`size-budget: ${dist} does not exist`);
  process.exit(2);
}

const EPISODE = /^(?:[a-z]{2}\/)?\d{4}-(0[1-9]|1[0-2])\/index\.html$/;
const pages: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EPISODE.test(p.slice(dist.length + 1).replaceAll('\\', '/'))) pages.push(p);
  }
};
walk(dist);

const localAsset = (url: string): string | null => {
  if (/^([a-z]+:)?\/\//i.test(url) || url.startsWith('data:')) return null;
  const clean = url.split(/[?#]/)[0];
  if (/\.(woff2?|ttf|otf|eot)$/i.test(clean)) return null;
  const rel = clean.startsWith(BASE) ? clean.slice(BASE.length) : clean.replace(/^\//, '');
  const file = join(dist, rel);
  return existsSync(file) ? file : null;
};

const gz = (file: string) => gzipSync(readFileSync(file), { level: 9 }).length;
const kb = (n: number) => (n / 1024).toFixed(1).padStart(7);
let failed = false;
console.log('page'.padEnd(26), ' gz HTML  gz CSS   gz JS gz TOTAL   (raw total)  KB');
for (const file of pages.sort()) {
  const html = readFileSync(file, 'utf8');
  const root = parse(html);
  const css = new Set<string>();
  const js = new Set<string>();
  for (const l of root.querySelectorAll('link[rel="stylesheet"]')) {
    const f = localAsset(l.getAttribute('href') ?? '');
    if (f) css.add(f);
  }
  for (const s of root.querySelectorAll('script[src]')) {
    const f = localAsset(s.getAttribute('src') ?? '');
    if (f) js.add(f);
  }
  for (const l of root.querySelectorAll('link[rel="modulepreload"]')) {
    const f = localAsset(l.getAttribute('href') ?? '');
    if (f) js.add(f);
  }
  const size = (set: Set<string>) => [...set].reduce((a, f) => a + statSync(f).size, 0);
  const gsize = (set: Set<string>) => [...set].reduce((a, f) => a + gz(f), 0);
  const gh = gz(file);
  const total = gh + gsize(css) + gsize(js);
  const raw = Buffer.byteLength(html) + size(css) + size(js);
  const over = total > BUDGET;
  failed ||= over;
  const name = file.slice(dist.length).replaceAll('\\', '/');
  console.log(name.padEnd(26), kb(gh), kb(gsize(css)), kb(gsize(js)), kb(total), `  (${kb(raw).trim()})`, over ? ' OVER BUDGET' : ' ok');
}
if (pages.length === 0) console.log('(no episode pages found - nothing to check)');
console.log(`budget: ${(BUDGET / 1024).toFixed(0)} KB per episode page (gzip transfer size, fonts excluded)`);
process.exit(failed ? 1 : 0);
