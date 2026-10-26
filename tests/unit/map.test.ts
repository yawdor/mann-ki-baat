import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse } from 'node-html-parser';
import PlacesMap from '../../src/components/episode/PlacesMap.astro';
import { projectPlaces, statePaths, stateBounds, MAP_W, MAP_H } from '../../src/lib/map';
import { loadEpisodes } from '../../src/lib/content';
import type { Place } from '../../src/lib/schema';

const place = (id: string, lat: number, lng: number): Place => ({
  id,
  name: { en: id, hi: `${id}-hi` },
  state: 'X',
  lat,
  lng,
  topicId: 't',
});

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

describe('map projection', () => {
  it('lands a New Delhi pin inside the Delhi state bounding box', () => {
    const [pin] = projectPlaces([place('new-delhi', 28.61, 77.21)], MAP_W, MAP_H);
    const [[x0, y0], [x1, y1]] = stateBounds('Delhi', MAP_W, MAP_H);
    expect(pin.id).toBe('new-delhi');
    expect(pin.x).toBeGreaterThanOrEqual(x0);
    expect(pin.x).toBeLessThanOrEqual(x1);
    expect(pin.y).toBeGreaterThanOrEqual(y0);
    expect(pin.y).toBeLessThanOrEqual(y1);
  });

  it('returns at least 28 state paths, all inside the viewBox', () => {
    const paths = statePaths(MAP_W, MAP_H);
    expect(paths.length).toBeGreaterThanOrEqual(28);
    expect(paths.every((d) => d.startsWith('M'))).toBe(true);
    const [[x0, y0], [x1, y1]] = stateBounds('Ladakh', MAP_W, MAP_H);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(y0).toBeGreaterThanOrEqual(-0.5);
    expect(x1).toBeLessThanOrEqual(MAP_W);
    expect(y1).toBeLessThanOrEqual(MAP_H);
  });

  it('skips places without coordinates', () => {
    const bad = { ...place('nowhere', 0, 0), lat: undefined as unknown as number };
    expect(projectPlaces([place('a', 19, 75.3), bad], MAP_W, MAP_H).map((p) => p.id)).toEqual(['a']);
  });
});

describe('PlacesMap component', () => {
  const render = async (places: Place[], lang: 'en' | 'hi' = 'en') =>
    parse(await container.renderToString(PlacesMap, { props: { places, lang } }));

  it('renders nothing for zero places', async () => {
    expect((await render([])).innerHTML.trim()).toBe('');
  });

  it('renders numbered pins, a localised aria-label and the note', async () => {
    const places = loadEpisodes('tests/fixtures/episodes').find((e) => e.places.length)!.places;
    const doc = await render(places);
    const svg = doc.querySelector('svg[role="img"]')!;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${MAP_W} ${MAP_H}`);
    expect(svg.hasAttribute('width')).toBe(false);
    for (const p of places) expect(svg.getAttribute('aria-label')).toContain(p.name.en);
    const pins = doc.querySelectorAll('[data-pin]');
    expect(pins.map((p) => p.getAttribute('data-pin'))).toEqual(places.map((p) => p.id));
    expect(pins.map((p) => p.querySelector('text')!.text)).toEqual(places.map((_, i) => String(i + 1)));
    expect(doc.querySelector('figcaption')!.text).toContain('Map for illustration; boundaries as per Survey of India.');
    expect(doc.querySelector('figcaption')!.text).toContain('Survey of India boundaries via DataMeet / ramSeraph');
    const hi = await render(places, 'hi');
    expect(hi.querySelector('svg[role="img"]')!.getAttribute('aria-label')).toContain(places[0].name.hi);
  });
});

describe('india-states.geojson boundary invariants', () => {
  const geo = JSON.parse(readFileSync('src/data/india-states.geojson', 'utf8')) as {
    features: { properties: { name: string }; geometry: { coordinates: unknown } }[];
  };
  const bbox = (name: string) => {
    const f = geo.features.find((x) => x.properties.name === name);
    if (!f) throw new Error(`missing feature ${name}`);
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    const walk = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === 'number') {
        const [lon, lat] = c as number[];
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      } else (c as unknown[]).forEach(walk);
    };
    walk(f.geometry.coordinates);
    return { minLon, minLat, maxLon, maxLat };
  };

  it('has exactly 36 features', () => {
    expect(geo.features).toHaveLength(36);
  });
  it('Ladakh reaches the claimed extent', () => {
    const b = bbox('Ladakh');
    expect(b.maxLat).toBeGreaterThanOrEqual(37.0);
    expect(b.minLon).toBeLessThanOrEqual(72.6);
    expect(b.maxLon).toBeGreaterThanOrEqual(80.3);
  });
  it('Arunachal Pradesh reaches the claimed extent', () => {
    const b = bbox('Arunachal Pradesh');
    expect(b.maxLon).toBeGreaterThanOrEqual(97.4);
    expect(b.maxLat).toBeGreaterThanOrEqual(29.4);
  });
  it('Jammu and Kashmir reaches the claimed west edge', () => {
    expect(bbox('Jammu and Kashmir').minLon).toBeLessThanOrEqual(73.5);
  });
});
