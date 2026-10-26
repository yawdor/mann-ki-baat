import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import rawStates from '../data/india-states.geojson?raw';
import type { Place } from './schema';

/** Fixed drawing size: the SVG scales with viewBox, so there is no fixed pixel width. */
export const MAP_W = 600;
export const MAP_H = 680;

interface StateFeature {
  type: 'Feature';
  properties: { name: string };
  geometry: { type: string; coordinates: unknown };
}
const collection = JSON.parse(rawStates) as { type: 'FeatureCollection'; features: StateFeature[] };

/**
 * Mapshaper writes RFC 7946 (counter-clockwise exterior rings); d3-geo wants the opposite
 * winding for spherical polygons, so reverse every ring once at load.
 */
type Ring = number[][];
const rewind = (g: StateFeature['geometry']): StateFeature['geometry'] => {
  const flip = (poly: Ring[]) => poly.map((r) => [...r].reverse());
  const coordinates =
    g.type === 'Polygon'
      ? flip(g.coordinates as Ring[])
      : (g.coordinates as Ring[][]).map(flip);
  return { type: g.type, coordinates };
};
const features = collection.features.map((f) => ({ ...f, geometry: rewind(f.geometry) }));

const projections = new Map<string, GeoProjection>();
function projection(width: number, height: number): GeoProjection {
  const key = `${width}x${height}`;
  let p = projections.get(key);
  if (!p) {
    p = geoMercator().fitExtent(
      [
        [8, 8],
        [width - 8, height - 8],
      ],
      { type: 'FeatureCollection', features } as never,
    );
    projections.set(key, p);
  }
  return p;
}

/** SVG path `d` strings, one per state / UT, in feature order. */
export function statePaths(width: number, height: number): string[] {
  const path = geoPath(projection(width, height));
  return features.map((f) => path(f as never) ?? '').filter(Boolean);
}

/** Pixel bounds [[x0,y0],[x1,y1]] of a state / UT by its `name` property. */
export function stateBounds(name: string, width: number, height: number): [[number, number], [number, number]] {
  const f = features.find((s) => s.properties.name === name);
  if (!f) throw new Error(`unknown state: ${name}`);
  return geoPath(projection(width, height)).bounds(f as never);
}

/** Projects places to pixel positions. Places without usable lat/lng are skipped. */
export function projectPlaces(
  places: Pick<Place, 'id' | 'lat' | 'lng'>[],
  width: number,
  height: number,
): { id: string; x: number; y: number }[] {
  const proj = projection(width, height);
  const out: { id: string; x: number; y: number }[] = [];
  for (const p of places) {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || Number.isNaN(p.lat) || Number.isNaN(p.lng)) continue;
    const xy = proj([p.lng, p.lat]);
    if (xy) out.push({ id: p.id, x: Math.round(xy[0] * 10) / 10, y: Math.round(xy[1] * 10) / 10 });
  }
  return out;
}
