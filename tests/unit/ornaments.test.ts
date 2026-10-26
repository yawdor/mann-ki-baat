import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Toran from '../../src/components/ornaments/Toran.astro';
import Mandala from '../../src/components/ornaments/Mandala.astro';
import BlockBand from '../../src/components/ornaments/BlockBand.astro';
import Kolam from '../../src/components/ornaments/Kolam.astro';
import Paisley from '../../src/components/ornaments/Paisley.astro';
import Ajrakh from '../../src/components/ornaments/Ajrakh.astro';
import { MOTIFS } from '../../src/lib/schema';

const render = async (c: any, props: Record<string, unknown> = {}) =>
  (await AstroContainer.create()).renderToString(c, { props });
const ids = (html: string) => [...html.matchAll(/<pattern id="([^"]+)"/g)].map((m) => m[1]);

describe('ornaments', () => {
  const cases: [string, any, Record<string, unknown>][] = [
    ['Toran', Toran, {}],
    ['Mandala', Mandala, { size: 100, motif: 'lotus' }],
    ['BlockBand haldi', BlockBand, { variant: 'haldi' }],
    ['BlockBand kumkum', BlockBand, { variant: 'kumkum' }],
    ['Kolam haldi', Kolam, { tone: 'haldi' }],
    ['Kolam mehendi', Kolam, { tone: 'mehendi' }],
    ['Paisley tl', Paisley, { corner: 'tl' }],
    ['Paisley br', Paisley, { corner: 'br' }],
    ['Ajrakh', Ajrakh, {}],
  ];
  it.each(cases)('%s renders an aria-hidden svg', async (_n, c, props) => {
    const html = await render(c, props);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('two Kolams get different pattern ids', async () => {
    const a = ids(await render(Kolam, { tone: 'haldi' }));
    const b = ids(await render(Kolam, { tone: 'haldi' }));
    expect(a).toHaveLength(1);
    expect(a[0]).not.toBe(b[0]);
  });

  it('Mandala carries data-motif for every motif', async () => {
    for (const motif of MOTIFS) {
      expect(await render(Mandala, { size: 100, motif })).toContain(`data-motif="${motif}"`);
    }
  });

  it('Mandala spin adds the spin class only when asked', async () => {
    expect(await render(Mandala, { size: 100, motif: 'diya', spin: true })).toMatch(/class="[^"]*spin/);
    expect(await render(Mandala, { size: 100, motif: 'diya' })).not.toMatch(/spin/);
  });

  it('Mandala uses unique ids and href targets exist', async () => {
    const html = await render(Mandala, { size: 100, motif: 'wheel' });
    const target = html.match(/href="#(hp1-[^"]+)"/)![1];
    expect(html).toContain(`id="${target}"`);
  });
});
