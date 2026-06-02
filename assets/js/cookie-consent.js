(function () {
  var STORAGE_KEY = 'pokwala_cookie_consent';

  if (localStorage.getItem(STORAGE_KEY)) return;

  var css = [
    '#pkw-cookie{',
      'position:fixed;bottom:0;left:0;right:0;z-index:9999;',
      'background:rgba(13,27,41,0.97);',
      'border-top:1px solid rgba(247,245,242,0.07);',
      'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
      'padding:18px 48px;',
      'display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;',
      'transform:translateY(100%);transition:transform 0.45s cubic-bezier(0.16,1,0.3,1);',
      'font-family:"DM Sans",sans-serif;',
    '}',
    '#pkw-cookie.pkw-visible{transform:translateY(0);}',
    '#pkw-cookie p{',
      'font-size:0.875rem;line-height:1.7;',
      'color:rgba(247,245,242,0.72);margin:0;flex:1;min-width:220px;',
    '}',
    '#pkw-cookie p a{',
      'color:#C9A84C;text-decoration:underline;text-underline-offset:3px;',
    '}',
    '#pkw-cookie p a:hover{color:#D9BB6E;}',
    '.pkw-btns{display:flex;align-items:center;gap:12px;flex-shrink:0;}',
    '.pkw-decline{',
      'font-family:inherit;font-size:0.875rem;font-weight:600;',
      'background:none;border:1px solid rgba(247,245,242,0.22);',
      'color:rgba(247,245,242,0.6);padding:9px 20px;border-radius:4px;',
      'cursor:pointer;transition:border-color 0.2s,color 0.2s;',
    '}',
    '.pkw-decline:hover{border-color:rgba(247,245,242,0.5);color:rgba(247,245,242,0.9);}',
    '.pkw-accept{',
      'font-family:inherit;font-size:0.875rem;font-weight:700;',
      'background:#C9A84C;color:#07111C;padding:9px 22px;border:none;',
      'border-radius:4px;cursor:pointer;transition:background 0.2s;',
    '}',
    '.pkw-accept:hover{background:#D9BB6E;}',
    '@media(max-width:640px){',
      '#pkw-cookie{padding:16px 20px;}',
      '#pkw-cookie p{font-size:0.8125rem;}',
      '.pkw-btns{width:100%;justify-content:flex-end;}',
    '}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var banner = document.createElement('div');
  banner.id = 'pkw-cookie';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML = [
    '<p>We use cookies to analyze site traffic and improve your experience.',
    ' <a href="/privacy-policy">Privacy Policy</a>.</p>',
    '<div class="pkw-btns">',
      '<button class="pkw-decline" aria-label="Decline cookies">Decline</button>',
      '<button class="pkw-accept" aria-label="Accept cookies">Accept</button>',
    '</div>'
  ].join('');

  document.body.appendChild(banner);

  setTimeout(function () { banner.classList.add('pkw-visible'); }, 600);

  function dismiss(choice) {
    localStorage.setItem(STORAGE_KEY, choice);
    banner.style.transition = 'transform 0.35s cubic-bezier(0.16,1,0.3,1)';
    banner.classList.remove('pkw-visible');
    setTimeout(function () { banner.remove(); }, 400);
  }

  banner.querySelector('.pkw-accept').addEventListener('click', function () { dismiss('accepted'); });
  banner.querySelector('.pkw-decline').addEventListener('click', function () { dismiss('declined'); });
})();
