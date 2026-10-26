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

/** Douglas-Peucker on an open polyline (iterative), tolerance in pixels. */
function simplify(pts: number[][], tol: number): number[][] {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const dx = pts[b][0] - ax;
    const dy = pts[b][1] - ay;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
      if (d > max) { max = d; at = i; }
    }
    if (at >= 0 && max > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Pixels: below this a vertex is invisible at the 600px drawing size, and every vertex costs HTML bytes and layout time. */
const SIMPLIFY_PX = 0.5;

/** SVG path `d` strings, one per state / UT, in feature order. Rings are simplified in pixel space. */
export function statePaths(width: number, height: number): string[] {
  const proj = projection(width, height);
  const flat = geoPath(); // planar: coordinates below are already pixels
  const ring = (r: Ring): Ring => {
    const px = r.map((c) => proj(c as [number, number]) as number[]);
    // A closed ring has identical ends, so split it at the vertex farthest from the start first.
    let far = 1;
    for (let i = 2; i < px.length - 1; i++) {
      if (Math.hypot(px[i][0] - px[0][0], px[i][1] - px[0][1]) > Math.hypot(px[far][0] - px[0][0], px[far][1] - px[0][1])) far = i;
    }
    const out = px.length > 8 ? [...simplify(px.slice(0, far + 1), SIMPLIFY_PX).slice(0, -1), ...simplify(px.slice(far), SIMPLIFY_PX)] : px;
    return out.length >= 4 ? out : px; // keep tiny rings (Delhi, Goa islands) intact
  };
  return features
    .map((f) => {
      const g = f.geometry;
      const coordinates =
        g.type === 'Polygon' ? (g.coordinates as Ring[]).map(ring) : (g.coordinates as Ring[][]).map((p) => p.map(ring));
      return flat.digits(1)({ type: 'Feature', properties: {}, geometry: { type: g.type, coordinates } } as never) ?? '';
    })
    .filter(Boolean);
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
