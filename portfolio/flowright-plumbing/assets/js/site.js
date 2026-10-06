/* Sticky-nav condense, mobile menu, scroll reveal, and a stand-in form
   handler. No dependencies, no build step. */

(function stickyNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  // A sentinel beats a scroll listener: no work on the main thread per frame.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText =
    'position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none;';
  document.body.prepend(sentinel);

  new IntersectionObserver(
    ([entry]) => nav.classList.toggle('is-stuck', !entry.isIntersecting),
    { threshold: 0 }
  ).observe(sentinel);
})();

(function mobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // Every link is an in-page anchor, so the panel has to close itself.
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  // The panel only exists below the nav breakpoint; leaving it "open" while
  // the desktop nav is showing would strand aria-expanded="true".
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
})();

(function scrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 }
  );

  items.forEach((el) => observer.observe(el));
})();

/* Stand-in submit handler. The template ships without a backend, so this keeps
   the form from navigating away and gives the visitor an answer. Delete this
   block once the <form> has a real action. */
(function quoteForm() {
  const form = document.querySelector('.quote-form');
  if (!form) return;

  const note = form.querySelector('[data-form-note]');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    form.reset();
    button.disabled = true;
    button.textContent = 'Request received';
    note.textContent = 'Thanks — we have your details and will call you shortly.';
  });
})();
