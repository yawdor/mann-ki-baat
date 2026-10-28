// Share cards: draws a 1080×1350 Utsav-style PNG for a topic and shares (Web Share API) or downloads it.

const W = 1080;
const H = 1350;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function draw(card: HTMLElement, site: string, footer: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const display = v('--font-display', 'serif');
  const body = v('--font-body', 'sans-serif');
  const accent = getComputedStyle(card).getPropertyValue('--c').trim() || v('--kumkum', '#7A1431');

  ctx.fillStyle = v('--kumkum', '#7A1431');
  ctx.fillRect(0, 0, W, H);
  // Arch panel in the topic colour.
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(80, H - 260);
  ctx.lineTo(80, 420);
  ctx.arc(W / 2, 420, W / 2 - 80, Math.PI, 0);
  ctx.lineTo(W - 80, H - 260);
  ctx.closePath();
  ctx.fill();
  // Marigold dots along the top, like a toran.
  ctx.fillStyle = v('--marigold', '#F07F13');
  for (let x = 40; x < W; x += 80) {
    ctx.beginPath();
    ctx.arc(x, 40, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = `700 34px ${body}`;
  ctx.fillText((card.dataset.shareCat ?? '').toUpperCase(), W / 2, 330);
  ctx.font = `76px ${display}`;
  let y = 450;
  for (const line of wrap(ctx, card.dataset.shareTitle ?? '', W - 260).slice(0, 4)) {
    ctx.fillText(line, W / 2, y);
    y += 92;
  }
  ctx.font = `40px ${body}`;
  y += 20;
  for (const line of wrap(ctx, card.dataset.shareText ?? '', W - 260).slice(0, 7)) {
    ctx.fillText(line, W / 2, y);
    y += 56;
  }
  ctx.fillStyle = v('--haldi', '#F2B705');
  ctx.font = `64px ${display}`;
  ctx.fillText('Mann Ki Baat, Explained', W / 2, H - 150);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `30px ${body}`;
  ctx.fillText(footer, W / 2, H - 95);
  ctx.fillText(site, W / 2, H - 50);
  return canvas;
}

document.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-share]');
  if (!btn) return;
  const card = btn.closest<HTMLElement>('[data-share-card]');
  const host = btn.closest<HTMLElement>('[data-share-site]');
  if (!card || !host) return;
  const canvas = draw(card, host.dataset.shareSite!, host.dataset.shareFooter!);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return;
  const name = `mann-ki-baat-${(card.dataset.shareTitle ?? 'topic').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'topic'}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: card.dataset.shareTitle, text: host.dataset.shareSite });
      return;
    }
  } catch {
    return; // user cancelled the share sheet
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
