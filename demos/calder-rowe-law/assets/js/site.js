/* Calder Rowe Law (demo): mobile menu, subtle scroll reveal, and a stand-in
   form handler. No dependencies, loaded with `defer`. */

(function mobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
})();

(function scrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  items.forEach((el) => io.observe(el));
})();

/* DEMO ONLY: nothing is sent anywhere. Replace with a real form endpoint
   (and a conflict-check workflow) before a client site goes live. */
(function consultForm() {
  const form = document.querySelector('.consult-form');
  if (!form) return;
  const notice = form.querySelector('.demo-notice');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    notice.classList.add('is-shown');
    notice.setAttribute('tabindex', '-1');
    notice.focus();
    form.querySelector('button[type="submit"]').disabled = true;
  });
})();
