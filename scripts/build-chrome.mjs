#!/usr/bin/env node
// Writes the shared header, mobile menu and footer into every site page.
//
//   node scripts/build-chrome.mjs          update pages
//   node scripts/build-chrome.mjs --check  exit 1 if any page is out of date
//
// Edit the menus here (SERVICES / COMPANY), never in the pages. Each page's copy lives
// between <!-- site-header --> / <!-- /site-header --> and <!-- site-footer --> / <!-- /site-footer -->.
// The current page gets aria-current="page"; service pages also highlight "Services" in the header.
// Pages without those markers (e.g. the portfolio demo sites) are left alone.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SERVICES = [
  { href: '/web-design', label: 'Web design packages' },
  { href: '/trades', label: 'Websites for trades' },
  { href: '/local-seo-services', label: 'Local SEO services' },
  { href: '/website-maintenance', label: 'Website maintenance' },
  { href: '/services', label: 'All services' },
];
// header: false keeps a link out of the desktop header (it stays in the mobile menu and footer).
const COMPANY = [
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  // { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact', header: false },
];
const CTA = { href: '/contact', label: 'Free website review →' };
const EMAIL = 'georgemangala@gmail.com';
const TAGLINE = 'SEO web design for small businesses. Websites built, ranked and managed, for small businesses across the US and Canada.';
const AREA = 'Serving small businesses across the US and Canada.';
const YEAR = '2026';

const CSS_TAG = '<link rel="stylesheet" href="/assets/css/site-chrome.css">';
const JS_TAG = '<script src="/assets/js/site-chrome.js" defer></script>';

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

function urlPath(file) {
  const p = '/' + file.replace(/\\/g, '/').replace(/\.html$/, '');
  return p === '/index' ? '/' : p.replace(/\/index$/, '');
}

const cur = (href, page) => (href === page ? ' aria-current="page"' : '');
const hoverLink = (href, label, page, extraClass = '') =>
  `<a class="nav-link${extraClass}" href="${href}"${cur(href, page)} data-cursor="hide"><span class="nl-default">${label}</span><span class="nl-hover" aria-hidden="true">${label}</span></a>`;

const CHEVRON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function header(page) {
  const inServices = SERVICES.some(s => s.href === page) && page !== '/services';
  const menu = SERVICES.map(s =>
    `              <li${s.href === '/services' ? ' class="nav-menu-all"' : ''}><a href="${s.href}"${cur(s.href, page)}>${s.label}</a></li>`).join('\n');
  const company = COMPANY.filter(c => c.header !== false).map(c =>
    `          <li>${hoverLink(c.href, c.label, page)}</li>`).join('\n');
  const list = (items) => items.map(i => `      <li><a href="${i.href}"${cur(i.href, page)}>${i.label}</a></li>`).join('\n');
  return `<!-- site-header -->
  <header class="nav${page === '/' ? ' nav--over-hero' : ''}" id="navbar" role="banner">
    <div class="nav-inner">
      <a class="nav-logo" href="/" aria-label="Pokwala, go to homepage">Pokwala</a>
      <nav aria-label="Primary navigation">
        <ul class="nav-links">
          <li class="nav-item">
            ${hoverLink('/services', 'Services', page, inServices ? ' is-current-section' : '')}
            <button class="nav-menu-toggle" type="button" aria-expanded="false" aria-controls="services-menu" aria-label="Services menu">${CHEVRON}</button>
            <ul class="nav-menu" id="services-menu" hidden>
${menu}
            </ul>
          </li>
${company}
          <li><a class="nav-cta" href="${CTA.href}">${CTA.label}</a></li>
        </ul>
      </nav>
      <button class="nav-hamburger" id="hamburger" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="mobile-nav">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <nav class="nav-mobile" id="mobile-nav" aria-label="Mobile navigation">
    <p class="nav-mobile-heading" id="mobile-services-heading">Services</p>
    <ul class="nav-mobile-list" aria-labelledby="mobile-services-heading">
${list(SERVICES)}
    </ul>
    <p class="nav-mobile-heading" id="mobile-company-heading">Company</p>
    <ul class="nav-mobile-list" aria-labelledby="mobile-company-heading">
${list(COMPANY)}
    </ul>
    <a class="nav-cta" href="${CTA.href}">${CTA.label}</a>
  </nav>
  <!-- /site-header -->`;
}

function footer(page) {
  const list = (items) => items.map(i => `              <li><a href="${i.href}"${cur(i.href, page)}>${i.label}</a></li>`).join('\n');
  return `<!-- site-footer -->
  <footer class="footer scroll-reveal" role="contentinfo">
    <div class="footer-inner">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="footer-logo" href="/" aria-label="Pokwala, go to homepage">Pokwala</a>
          <p class="footer-tagline">${TAGLINE}</p>
          <a class="nav-cta" href="${CTA.href}">${CTA.label}</a>
        </div>
        <nav class="footer-col" aria-labelledby="footer-services-heading">
          <h2 class="footer-heading" id="footer-services-heading">Services</h2>
          <ul class="footer-list">
${list(SERVICES)}
          </ul>
        </nav>
        <nav class="footer-col" aria-labelledby="footer-company-heading">
          <h2 class="footer-heading" id="footer-company-heading">Company</h2>
          <ul class="footer-list">
${list(COMPANY)}
          </ul>
        </nav>
        <div class="footer-col">
          <h2 class="footer-heading">Get in touch</h2>
          <ul class="footer-list">
            <li><a href="mailto:${EMAIL}">${EMAIL}</a></li>
          </ul>
          <p class="footer-note">${AREA}</p>
        </div>
      </div>
      <div class="footer-divider"></div>
      <div class="footer-bottom">
        <p class="footer-copy">&copy; ${YEAR} Pokwala. All rights reserved.</p>
        <a class="footer-legal" href="/privacy-policy"${cur('/privacy-policy', page)}>Privacy Policy</a>
      </div>
    </div>
  </footer>
  <!-- /site-footer -->`;
}

function render(html, page) {
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const fix = (s) => s.replace(/\r?\n/g, eol);
  let out = html.replace(/<!-- site-header -->[\s\S]*?<!-- \/site-header -->/, () => fix(header(page)))
                .replace(/<!-- site-footer -->[\s\S]*?<!-- \/site-footer -->/, () => fix(footer(page)));
  if (!out.includes(CSS_TAG)) out = out.replace('</head>', `  ${CSS_TAG}${eol}</head>`);
  if (!out.includes(JS_TAG)) out = out.replace('</body>', `  ${JS_TAG}${eol}</body>`);
  return out;
}

const check = process.argv.includes('--check');
const stale = [];
for (const file of git('ls-files', '--', '*.html').split('\n').filter(Boolean)) {
  const full = path.join(ROOT, file);
  const html = readFileSync(full, 'utf8');
  if (!html.includes('<!-- site-header -->') || !html.includes('<!-- site-footer -->')) continue;
  const out = render(html, urlPath(file));
  if (out === html) continue;
  stale.push(file);
  if (!check) writeFileSync(full, out);
}

if (check) {
  if (stale.length) {
    console.error('Header/footer out of date in: ' + stale.join(', ') + '\nRun: node scripts/build-chrome.mjs');
    process.exit(1);
  }
  console.log('Header and footer are up to date.');
} else {
  console.log(stale.length ? 'Updated header/footer in: ' + stale.join(', ') : 'Header and footer already up to date.');
}
