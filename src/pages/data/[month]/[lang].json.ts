import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEpisodes } from '../../../lib/content';
import { monthOf } from '../../../lib/episode-paths';

/** Saved transcripts live beside the content dir: `sources/` for real builds, `<MKB_CONTENT_DIR>/sources` for fixtures. */
const sourcesRoot = () => (process.env.MKB_CONTENT_DIR ? join(process.env.MKB_CONTENT_DIR, 'sources') : 'sources');

export function getStaticPaths() {
  return loadEpisodes().flatMap((ep) => {
    const month = monthOf(ep);
    return (['en', 'hi'] as const)
      .filter((lang) => existsSync(join(sourcesRoot(), month, `${lang}.paras.json`)))
      .map((lang) => ({ params: { month, lang } }));
  });
}

/** Transcript paragraphs for the "Ask about this episode" search, fetched only when the reader searches. */
export function GET({ params }: { params: { month: string; lang: string } }) {
  const paras = readFileSync(join(sourcesRoot(), params.month, `${params.lang}.paras.json`), 'utf8');
  return new Response(paras, { headers: { 'Content-Type': 'application/json' } });
}
