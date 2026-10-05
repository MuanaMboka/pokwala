/* ============================================================================
   DEMO BADGE — not part of the template a client receives.
   Self-contained on purpose: styles and markup both live here, so removing the
   single <script> tag from index.html strips every trace of it. Nothing in
   site.css or tokens.css knows this file exists.
   ============================================================================ */

(function demoBadge() {
  var KEY = 'ridgeline-demo-badge-dismissed';

  // sessionStorage, not localStorage: the notice should come back for the next
  // visitor on a shared machine, but not nag during one browse.
  try {
    if (sessionStorage.getItem(KEY) === '1') return;
  } catch (e) {
    /* private mode or blocked storage - show the badge, it is the safe default */
  }

  var css = [
    '.demo-badge{',
    '  position:fixed; z-index:90;',
    '  left:16px; bottom:calc(16px + env(safe-area-inset-bottom, 0px));',
    '  display:flex; align-items:center; gap:4px;',
    '  padding:9px 9px 9px 16px; border-radius:999px;',
    '  background:rgba(20,26,34,.92); backdrop-filter:blur(10px);',
    '  border:1px solid rgba(255,255,255,.18);',
    '  box-shadow:0 8px 28px rgba(0,0,0,.4);',
    "  font-family:'Archivo',ui-sans-serif,system-ui,sans-serif; font-size:13px; line-height:1;",
    '  color:#fff; max-width:calc(100vw - 32px);',
    '}',
    '.demo-badge__text{color:#9AA4B0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}',
    '.demo-badge__text b{color:#fff; font-weight:600;}',
    '.demo-badge__link{color:#fff; font-weight:600; text-decoration:none;',
    '  border-bottom:1px solid rgba(255,255,255,.4); padding-bottom:1px; white-space:nowrap;}',
    '.demo-badge__link:hover{border-bottom-color:#fff;}',
    '.demo-badge__sep{color:rgba(255,255,255,.3); padding:0 2px;}',
    '.demo-badge__close{',
    '  flex:none; width:28px; height:28px; margin-left:4px; border:0; border-radius:50%;',
    '  background:rgba(255,255,255,.1); color:#fff; font-size:15px; line-height:1;',
    '  cursor:pointer; display:flex; align-items:center; justify-content:center;',
    '  transition:background 180ms ease;',
    '}',
    '.demo-badge__close:hover{background:rgba(255,255,255,.2);}',
    '.demo-badge :focus-visible{outline:2px solid #C8823A; outline-offset:2px;}',
    // Narrow screens drop the long sentence. The pill must then shrink to its
    // content - pinning both edges leaves a wide, mostly empty capsule.
    '@media (max-width:520px){',
    '  .demo-badge{font-size:12px; padding-left:14px; left:12px;',
    '    bottom:calc(12px + env(safe-area-inset-bottom, 0px)); max-width:calc(100vw - 24px);}',
    '  .demo-badge__full{display:none;}',
    '}',
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var el = document.createElement('aside');
  el.className = 'demo-badge';
  el.setAttribute('aria-label', 'Demo notice');
  el.innerHTML =
    '<span class="demo-badge__text">' +
      '<b>Demo</b><span class="demo-badge__full"> &middot; Ridgeline Auto is a fictional shop</span>' +
    '</span>' +
    '<span class="demo-badge__sep">&middot;</span>' +
    '<a class="demo-badge__link" href="https://pokwala.com/web-design#packages" ' +
       'target="_blank" rel="noopener">Pokwala</a>' +
    '<button class="demo-badge__close" type="button" aria-label="Dismiss demo notice">&times;</button>';

  el.querySelector('.demo-badge__close').addEventListener('click', function () {
    el.remove();
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* nothing to do */ }
  });

  document.body.appendChild(el);
})();
