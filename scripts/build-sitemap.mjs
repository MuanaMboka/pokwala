#!/usr/bin/env node
// Builds sitemap.xml from the site's HTML pages.
//
//   node scripts/build-sitemap.mjs          write sitemap.xml
//   node scripts/build-sitemap.mjs --check  exit 1 if sitemap.xml is out of date
//
// A page is included when it is tracked (or staged) in git, is not 404.html,
// and is not marked noindex, either by <meta name="robots" content="noindex">
// or by an X-Robots-Tag noindex header rule in vercel.json.
// URLs follow vercel.json's cleanUrls: about.html -> /about, blog/index.html -> /blog.
// lastmod is the date of the last commit that touched the page (today if it has
// uncommitted changes). Priority comes from PRIORITY below, else DEFAULT_PRIORITY.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://pokwala.com';
const OUT = path.join(ROOT, 'sitemap.xml');

const PRIORITY = {
  '/': '1.0',
  '/web-design': '0.9',
  '/trades': '0.9',
  '/portfolio': '0.8',
  '/services': '0.8',
  '/local-seo-services': '0.8',
  '/about': '0.7',
  '/faq': '0.7',
  '/contact': '0.6',
  '/privacy-policy': '0.2',
};
const DEFAULT_PRIORITY = '0.6';
const EXCLUDE_FILES = new Set(['404.html']);

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const today = new Date().toISOString().slice(0, 10);

// Turn a vercel.json "source" pattern into a RegExp (covers :param, :param*, (.*)).
function sourceToRegExp(source) {
  const re = source
    .replace(/[.+?^${}|[\]\\]/g, '\\$&')
    .replace(/:(\w+)\*/g, '.*')
    .replace(/:(\w+)/g, '[^/]+')
    .replace(/\\?\(\.\*\)/g, '.*');
  return new RegExp('^' + re + '$');
}

const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const noindexRules = (vercel.headers || [])
  .filter(rule => rule.headers.some(h => h.key.toLowerCase() === 'x-robots-tag' && /noindex/i.test(h.value)))
  .map(rule => sourceToRegExp(rule.source));

function urlPath(file) {
  let p = '/' + file.replace(/\\/g, '/').replace(/\.html$/, '');
  if (p === '/index') return '/';
  return p.replace(/\/index$/, '');
}

function lastmod(file) {
  if (git('status', '--porcelain', '--', file)) return today;
  return git('log', '-1', '--format=%cs', '--', file) || today;
}

const files = git('ls-files', '--', '*.html').split('\n').filter(Boolean);
const pages = [];
for (const file of files) {
  if (EXCLUDE_FILES.has(file) || !existsSync(path.join(ROOT, file))) continue;
  const html = readFileSync(path.join(ROOT, file), 'utf8');
  if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) continue;
  const p = urlPath(file);
  if (noindexRules.some(re => re.test(p))) continue;
  pages.push({ path: p, lastmod: lastmod(file), priority: PRIORITY[p] || DEFAULT_PRIORITY });
}
pages.sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));

const eol = existsSync(OUT) && readFileSync(OUT, 'utf8').includes('\r\n') ? '\r\n' : '\n';
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map(pg => [
    '  <url>',
    `    <loc>${ORIGIN}${pg.path}</loc>`,
    `    <lastmod>${pg.lastmod}</lastmod>`,
    `    <priority>${pg.priority}</priority>`,
    '  </url>',
  ].join(eol)),
  '</urlset>',
  '',
].join(eol);

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== xml) {
    console.error('sitemap.xml is out of date. Run: node scripts/build-sitemap.mjs');
    process.exit(1);
  }
  console.log(`sitemap.xml is up to date (${pages.length} URLs).`);
} else {
  writeFileSync(OUT, xml);
  console.log(`Wrote sitemap.xml with ${pages.length} URLs.`);
}
