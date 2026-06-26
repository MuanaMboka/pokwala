// AI Visibility Checker — analysis endpoint
// Fetches the submitted site, derives local-SEO / GEO (AI-search) readiness
// signals via HTML heuristics, then (optionally) uses Claude to turn those
// signals into a prioritized, plain-English fix list.
//
// The Anthropic key is read from ANTHROPIC_API_KEY, with a fallback to the
// project's existing "NouveauRiche" variable name. Set ANTHROPIC_API_KEY in
// the Vercel dashboard; never commit the secret.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.NouveauRiche || '';
const MODEL = 'claude-haiku-4-5-20251001';
const FETCH_TIMEOUT_MS = 9000;
const MAX_HTML_BYTES = 500000;
const UA = 'PokwalaVisibilityChecker/1.0 (+https://pokwala.vercel.app)';

/* ---------- SSRF / input guards ---------- */
function isBlockedHost(hostname) {
  const h = (hostname || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h === '0.0.0.0') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const p = h.split('.').map(Number);
    if (p.some((n) => n > 255)) return true;
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
  }
  return false;
}

function normalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let v = raw.trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(u.hostname)) return null;
    if (isBlockedHost(u.hostname)) return null;
    return u;
  } catch (_) {
    return null;
  }
}

async function fetchText(url, accept) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: accept || 'text/html,*/*' },
    });
    const text = (await resp.text()).slice(0, MAX_HTML_BYTES);
    return { ok: resp.ok, status: resp.status, finalUrl: resp.url || url, text };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, text: '', error: String(e && e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

/* ---------- HTML heuristics ---------- */
function pick(re, html) { const m = html.match(re); return m ? m[1].trim() : ''; }

function analyzeHtml(html, finalUrl) {
  const lower = html.toLowerCase();
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const metaDesc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const h1Count = (html.match(/<h1[\b>]/gi) || []).length;
  const canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const ogTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
  const ogImage = /<meta[^>]+property=["']og:image["']/i.test(html);
  const metaRobotsNoindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);

  // structured data
  const ldBlocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const ldJoined = ldBlocks.join(' ').toLowerCase();
  const hasSchema = ldBlocks.length > 0;
  const hasLocalBusiness = /"@type"\s*:\s*"?(localbusiness|[a-z]*business|store|professionalservice|organization)/i.test(ldJoined);
  const hasPostalAddress = ldJoined.includes('postaladdress') || ldJoined.includes('"address"');
  const hasGeo = ldJoined.includes('"geo"') || ldJoined.includes('geocoordinates');

  // NAP-ish signals in raw text
  const hasPhone = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(html);
  const hasCaPostal = /\b[a-z]\d[a-z]\s?\d[a-z]\d\b/i.test(html);
  const hasMapEmbed = lower.includes('google.com/maps') || lower.includes('maps.google') || lower.includes('goo.gl/maps') || lower.includes('g.page');

  // content extractability: ratio of visible text to markup
  const textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const textLen = textOnly.length;
  const thinContent = textLen < 600;

  return {
    title, titleLen: title.length, metaDesc, metaDescLen: metaDesc.length,
    viewport, h1Count, canonical, ogTitle, ogImage, metaRobotsNoindex,
    hasSchema, hasLocalBusiness, hasPostalAddress, hasGeo,
    hasPhone, hasCaPostal, hasMapEmbed, textLen, thinContent,
    isHttps: finalUrl.startsWith('https://'),
  };
}

function parseRobots(robotsTxt) {
  const out = { fetched: !!robotsTxt, hasSitemap: false, aiCrawlers: {} };
  if (!robotsTxt) return out;
  out.hasSitemap = /^\s*sitemap\s*:/im.test(robotsTxt);
  const bots = ['GPTBot', 'Google-Extended', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'CCBot'];
  // build map of user-agent -> disallow lines
  const lines = robotsTxt.split(/\r?\n/);
  let current = [];
  const blocks = [];
  let collecting = null;
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const ua = line.match(/^user-agent\s*:\s*(.+)$/i);
    if (ua) {
      if (collecting) blocks.push(collecting);
      collecting = { agents: [ua[1].trim().toLowerCase()], disallows: [] };
    } else if (collecting) {
      const da = line.match(/^disallow\s*:\s*(.*)$/i);
      if (da) collecting.disallows.push(da[1].trim());
    }
  }
  if (collecting) blocks.push(collecting);
  for (const bot of bots) {
    const b = bot.toLowerCase();
    const block = blocks.find((x) => x.agents.includes(b));
    // allowed unless an explicit block disallows "/"
    const blocked = block ? block.disallows.some((d) => d === '/') : false;
    out.aiCrawlers[bot] = blocked ? 'blocked' : 'allowed';
  }
  return out;
}

/* ---------- scoring ---------- */
function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

function scoreSite(s, robots) {
  const aiAllowed = Object.values(robots.aiCrawlers || {}).filter((v) => v === 'allowed').length;
  const aiTotal = Object.keys(robots.aiCrawlers || {}).length || 6;

  const findability = clamp(
    (s.metaRobotsNoindex ? 0 : 35) +
    (s.title ? 20 : 0) + (s.titleLen >= 15 && s.titleLen <= 65 ? 10 : 0) +
    (s.metaDesc ? 15 : 0) + (s.metaDescLen >= 50 && s.metaDescLen <= 165 ? 10 : 0) +
    (s.canonical ? 10 : 0)
  );
  const local = clamp(
    (s.hasLocalBusiness ? 30 : 0) + (s.hasPostalAddress ? 15 : 0) + (s.hasGeo ? 10 : 0) +
    (s.hasPhone ? 15 : 0) + (s.hasCaPostal ? 10 : 0) + (s.hasMapEmbed ? 20 : 0)
  );
  const aiReady = clamp(
    (aiAllowed / aiTotal) * 40 +
    (s.hasSchema ? 25 : 0) +
    (s.thinContent ? 0 : 20) +
    (s.ogTitle ? 8 : 0) + (s.ogImage ? 7 : 0)
  );
  const technical = clamp(
    (s.isHttps ? 40 : 0) + (s.viewport ? 30 : 0) +
    (s.h1Count >= 1 ? 20 : 0) + (s.h1Count === 1 ? 10 : 0)
  );

  const overall = clamp(findability * 0.3 + local * 0.3 + aiReady * 0.25 + technical * 0.15);
  return {
    overall,
    grade: overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 55 ? 'D' : 'F',
    categories: [
      { name: 'Findability', score: findability, detail: 'Can search engines index and understand your pages' },
      { name: 'Local signals', score: local, detail: 'Business name, address, phone, and local schema' },
      { name: 'AI search readiness', score: aiReady, detail: 'Whether AI engines can crawl and cite you' },
      { name: 'Technical basics', score: technical, detail: 'HTTPS, mobile, and clean page structure' },
    ],
  };
}

function ruleFixes(s, robots) {
  const fixes = [];
  const blockedBots = Object.entries(robots.aiCrawlers || {}).filter(([, v]) => v === 'blocked').map(([k]) => k);
  if (blockedBots.length) fixes.push({ priority: 'high', title: 'Allow AI search crawlers', why: `Your robots.txt blocks ${blockedBots.join(', ')}, so these AI engines can't read or cite your site.` });
  if (!s.hasLocalBusiness) fixes.push({ priority: 'high', title: 'Add LocalBusiness structured data', why: 'No LocalBusiness/Organization schema found. This is how Google and AI confirm your business details.' });
  if (!s.hasPhone || !s.hasCaPostal) fixes.push({ priority: 'high', title: 'Show complete NAP details', why: 'A consistent name, address, and phone number in the page text strengthens local ranking.' });
  if (s.metaRobotsNoindex) fixes.push({ priority: 'high', title: 'Remove the noindex tag', why: 'Your homepage tells search engines not to index it.' });
  if (!s.metaDesc) fixes.push({ priority: 'medium', title: 'Write a meta description', why: 'Missing meta description; this is often the snippet shown in results.' });
  if (!s.title) fixes.push({ priority: 'medium', title: 'Add a page title', why: 'No <title> found.' });
  if (!s.viewport) fixes.push({ priority: 'medium', title: 'Add a mobile viewport tag', why: 'Without it, the site is not mobile-friendly.' });
  if (s.thinContent) fixes.push({ priority: 'medium', title: 'Add more crawlable text', why: 'Very little readable text in the HTML, which limits what AI can cite.' });
  if (!s.isHttps) fixes.push({ priority: 'high', title: 'Switch to HTTPS', why: 'The site is not served securely.' });
  if (!robots.hasSitemap) fixes.push({ priority: 'low', title: 'Publish a sitemap', why: 'No sitemap referenced in robots.txt.' });
  return fixes.slice(0, 6);
}

async function claudeFixes(url, s, robots, score) {
  if (!ANTHROPIC_KEY) return null;
  const prompt = `You are a local SEO and AI-search (GEO) expert helping an Ottawa small business. Based ONLY on these detected signals for ${url}, write a prioritized fix list.

Signals (JSON): ${JSON.stringify({ ...s, robots, score: score.overall, categories: score.categories })}

Return STRICT JSON only, no prose, shape:
{"summary":"one encouraging sentence about where they stand","fixes":[{"priority":"high|medium|low","title":"short action","why":"one plain-English sentence, specific to the signals"}]}
Max 6 fixes, ordered most-impactful first. No em dashes.`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.warn('[grade] Anthropic error', resp.status, errText.slice(0, 300));
      return { _error: `anthropic_${resp.status}` };
    }
    const data = await resp.json();
    const text = (data.content || []).map((c) => c.text || '').join('').trim();
    const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (e) {
    console.warn('[grade] Anthropic call failed', String(e && e.message || e));
    return { _error: 'anthropic_exception' };
  } finally {
    clearTimeout(t);
  }
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const target = normalizeUrl(body && body.url);
  if (!target) return res.status(400).json({ error: 'Please provide a valid website URL.' });

  const page = await fetchText(target.href, 'text/html');
  if (!page.text) {
    return res.status(200).json({ ok: false, reachable: false, url: target.href, message: 'We could not reach that website. Check the address and try again.' });
  }

  const robotsRes = await fetchText(new URL('/robots.txt', target.origin).href, 'text/plain');
  const signals = analyzeHtml(page.text, page.finalUrl);
  const robots = parseRobots(robotsRes.ok ? robotsRes.text : '');
  const score = scoreSite(signals, robots);

  let generatedBy = 'rules';
  let summary = '';
  let fixes = ruleFixes(signals, robots);
  const ai = await claudeFixes(target.href, signals, robots, score);
  if (ai && Array.isArray(ai.fixes) && ai.fixes.length) {
    fixes = ai.fixes.slice(0, 6);
    summary = ai.summary || '';
    generatedBy = 'claude';
  }

  return res.status(200).json({
    ok: true,
    reachable: true,
    url: page.finalUrl,
    checkedAt: new Date().toISOString(),
    score: score.overall,
    grade: score.grade,
    categories: score.categories,
    signals,
    robots,
    summary,
    fixes,
    generatedBy,
    keyConfigured: !!ANTHROPIC_KEY,
  });
}
