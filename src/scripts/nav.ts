// Mobile menu toggle, and language links that keep the current #hash.
const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  const set = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) set(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      set(false);
      toggle.focus();
    }
  });
}

const langLinks = [...document.querySelectorAll<HTMLAnchorElement>('a[data-keep-hash]')];
const bases = langLinks.map((a) => a.getAttribute('href')!.split('#')[0]);
function syncHash() {
  langLinks.forEach((a, i) => a.setAttribute('href', bases[i] + location.hash));
}
window.addEventListener('hashchange', syncHash);
syncHash();

export {};
