// Topic filter chips: `button[data-filter]` toggle `hidden` on `[data-category]` cards.
const chips = [...document.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
const cards = [...document.querySelectorAll<HTMLElement>('[data-category]')];

function apply(filter: string) {
  for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
  for (const card of cards) card.hidden = filter !== 'all' && card.dataset.category !== filter;
}

for (const chip of chips) chip.addEventListener('click', () => apply(chip.dataset.filter ?? 'all'));

// Following a link to a hidden card (e.g. from At a glance) clears the filter first.
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('a[href^="#topic-"]');
  const target = a && document.getElementById(a.getAttribute('href')!.slice(1));
  if (target?.hidden) apply('all');
});

export {};
