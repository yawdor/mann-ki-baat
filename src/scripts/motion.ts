// Bloom-in on scroll and one-time count-up. Does nothing under reduced motion
// (CSS then shows every .bloom element as-is).
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function countUp(el: HTMLElement) {
  const end = Number(el.dataset.countup);
  if (!Number.isFinite(end) || end <= 0) return;
  const start = performance.now();
  const ms = 900;
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / ms);
    el.textContent = String(Math.round(end * (1 - (1 - p) ** 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

const blooms = [...document.querySelectorAll<HTMLElement>('.bloom')];
const counters = [...document.querySelectorAll<HTMLElement>('[data-countup]')];

if (reduce || !('IntersectionObserver' in window)) {
  for (const el of blooms) el.classList.add('visible');
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        if (el.dataset.countup !== undefined) countUp(el);
        else el.classList.add('visible');
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  for (const el of [...blooms, ...counters]) io.observe(el);
}

export {};
