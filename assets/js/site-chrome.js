/* Shared header behaviour. All menu links are already in the HTML; this only shows and hides them.
   Opening and closing the mobile menu itself is handled by each page's script (#hamburger -> #mobile-nav.open). */
(function () {
  /* ── Services dropdown (click/tap to toggle, works the same with mouse, touch and keyboard) ── */
  document.querySelectorAll('.nav-menu-toggle').forEach(function (btn) {
    var menu = document.getElementById(btn.getAttribute('aria-controls'));
    var item = btn.closest('.nav-item');
    if (!menu || !item) return;

    function setOpen(open) {
      btn.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', function (e) {
      if (!item.contains(e.target)) setOpen(false);
    });
    item.addEventListener('focusout', function (e) {
      if (e.relatedTarget && !item.contains(e.relatedTarget)) setOpen(false);
    });
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        btn.focus();
      }
    });
  });

  /* ── Mobile menu: lock page scroll while open, close on Esc or on link tap ── */
  var mobileNav = document.getElementById('mobile-nav');
  var hamburger = document.getElementById('hamburger');
  if (!mobileNav || !hamburger) return;

  function close() {
    if (typeof window.closeMobileNav === 'function') window.closeMobileNav();
  }
  new MutationObserver(function () {
    document.documentElement.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
  }).observe(mobileNav, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
      close();
      hamburger.focus();
    }
  });
  mobileNav.addEventListener('click', function (e) {
    if (e.target.closest('a')) close();
  });
})();
