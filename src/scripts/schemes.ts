// Scheme search box and audience chips over every `[data-scheme]` element (episode-page
// cards or scheme-index table rows, each with data-search / data-audiences); cards with a
// toggle button also expand/collapse.
const cards = [...document.querySelectorAll<HTMLElement>('[data-scheme]')];
const search = document.querySelector<HTMLInputElement>('#scheme-search');
const audChips = [...document.querySelectorAll<HTMLButtonElement>('button[data-audience]')];
const empty = document.querySelector<HTMLElement>('#scheme-list .empty');

function setOpen(card: HTMLElement, open: boolean) {
  const btn = card.querySelector<HTMLButtonElement>('button[aria-expanded]');
  if (!btn) return;
  btn.setAttribute('aria-expanded', String(open));
  const panel = document.getElementById(btn.getAttribute('aria-controls') ?? '');
  if (panel) panel.hidden = !open;
}

for (const card of cards) {
  const btn = card.querySelector<HTMLButtonElement>('button[aria-expanded]');
  btn?.addEventListener('click', () => setOpen(card, btn.getAttribute('aria-expanded') !== 'true'));
}

/** Opens the card a `#scheme-<id>` link points at. */
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const card = id.startsWith('scheme-') ? document.getElementById(id) : null;
  if (card?.dataset.scheme) {
    card.hidden = false;
    setOpen(card, true);
  }
}
window.addEventListener('hashchange', openFromHash);
openFromHash();

function filter() {
  const words = (search?.value ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const auds = audChips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.audience!);
  let shown = 0;
  for (const card of cards) {
    const text = card.dataset.search ?? '';
    const mine = (card.dataset.audiences ?? '').split(' ');
    const ok = words.every((w) => text.includes(w)) && (!auds.length || auds.some((a) => mine.includes(a)));
    card.hidden = !ok;
    if (ok) shown++;
  }
  if (empty) empty.hidden = shown > 0;
}

search?.addEventListener('input', filter);
for (const chip of audChips) {
  chip.addEventListener('click', () => {
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
    filter();
  });
}

export {};
