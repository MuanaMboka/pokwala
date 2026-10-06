/* Sticky-nav condense + scroll reveal. No dependencies. */

(function stickyNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  // A sentinel beats a scroll listener: no work on the main thread per frame.
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none;';
  document.body.prepend(sentinel);

  new IntersectionObserver(
    ([entry]) => nav.classList.toggle('is-stuck', !entry.isIntersecting),
    { threshold: 0 }
  ).observe(sentinel);
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
