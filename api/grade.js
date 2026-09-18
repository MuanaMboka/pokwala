// AI Visibility Checker — analysis endpoint (deterministic)
//
// Every finding is derived directly from the site's served HTML and robots.txt.
// There is no AI/LLM step and nothing is inferred or invented: each line states
// exactly what was checked and the literal result, with the evidence.
//
// Hard limitation, disclosed in the report: this reads the HTML the server
// returns and does NOT execute JavaScript, so content rendered in the browser
// (common on React/Vue/SPA sites) is not seen. It measures readiness signals;
// it does not query Google, ChatGPT, or other engines directly.

import { lookup } from 'node:dns/promises';

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 600000;
const UA = 'PokwalaVisibilityChecker/1.0 (+https://pokwala.com)';

export const maxDuration = 30;

const METHOD_NOTE =
  'Based on the HTML your site returns and its robots.txt. This tool does not run JavaScript, ' +
  'so content rendered in the browser may not be detected, and it does not query Google or AI ' +
  'engines directly. It measures whether the signals search and AI engines look for are present.';

/* ---------- SSRF / input guards ---------- */
function isBlockedHost(hostname) {
  const h = (hostname || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h === '0.0.0.0') return true;
  return false;
}

// Classify a resolved address. Anything we cannot parse is treated as private
// (fail closed) rather than fetched.
function ipIsPrivate(ip, family) {
  if (family === 6) {
    const v = String(ip).toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd')) return true; // unique local
    if (v.startsWith('fe80')) return true;                     // link local
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipIsPrivate(mapped[1], 4);
    return false;
  }
  const parts = String(ip).split('.');
  if (parts.length !== 4) return true;
  const p = parts.map(Number);
  if (p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
  if (p[0] === 169 && p[1] === 254) return true;               // link local / cloud metadata
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;  // CGNAT
  if (p[0] >= 224) return true;                                // multicast / reserved
  return false;
}

// Resolve the hostname and reject it if ANY address is private. This is what
// catches zero-padded literals (0177.0.0.1), DNS names pointed at internal
// hosts, and redirect targets. Returns a reason string, or null when the host
// is safe to fetch. "unresolved" is kept distinct from "private" so a DNS
// failure is not reported to the user as an internal-network address.
async function hostGuardReason(hostname) {
  let addrs;
  try {
    addrs = await lookup(hostname, { all: true });
  } catch (_) {
    return 'unresolved';
  }
  if (!addrs || !addrs.length) return 'unresolved';
  return addrs.some((a) => ipIsPrivate(a.address, a.family)) ? 'private' : null;
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

async function fetchText(startUrl, accept) {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let u;
    try { u = new URL(url); } catch (_) {
      return { ok: false, status: 0, finalUrl: String(url), text: '', error: 'Invalid redirect target' };
    }
    if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) {
      return { ok: false, status: 0, finalUrl: u.href, text: '', error: 'Blocked host' };
    }
    const guard = await hostGuardReason(u.hostname);
    if (guard === 'private') {
      return { ok: false, status: 0, finalUrl: u.href, text: '', error: 'Blocked host' };
    }
    if (guard === 'unresolved') {
      return { ok: false, status: 0, finalUrl: u.href, text: '', error: 'Unresolved host' };
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let resp;
    try {
      resp = await fetch(u.href, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: accept || 'text/html,*/*' },
      });
    } catch (e) {
      clearTimeout(t);
      return { ok: false, status: 0, finalUrl: u.href, text: '', error: String((e && e.message) || e) };
    }
    const loc = resp.status >= 300 && resp.status < 400 ? resp.headers.get('location') : null;
    if (loc) {
      clearTimeout(t);
      try { url = new URL(loc, u.href).href; } catch (_) {
        return { ok: false, status: 0, finalUrl: u.href, text: '', error: 'Invalid redirect target' };
      }
      continue;
    }
    try {
      const text = (await resp.text()).slice(0, MAX_HTML_BYTES);
      return { ok: resp.ok, status: resp.status, finalUrl: u.href, text };
    } catch (e) {
      return { ok: false, status: resp.status, finalUrl: u.href, text: '', error: String((e && e.message) || e) };
    } finally {
      clearTimeout(t);
    }
  }
  return { ok: false, status: 0, finalUrl: String(url), text: '', error: 'Too many redirects' };
}

/* ---------- raw signals (all measured, never inferred) ---------- */
function pick(re, html) { const m = html.match(re); return m ? m[1].trim() : ''; }

function analyzeHtml(html, finalUrl) {
  const lower = html.toLowerCase();
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const metaDesc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const ogTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
  const ogImage = /<meta[^>]+property=["']og:image["']/i.test(html);
  const metaRobotsNoindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);

  const ldBlocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  const ldJoined = ldBlocks.join(' ').toLowerCase();
  const hasSchema = ldBlocks.length > 0;
  const localTypes = ['localbusiness','store','restaurant','professionalservice','homeandconstructionbusiness',
    'generalcontractor','plumber','electrician','roofingcontractor','hvacbusiness','legalservice','medicalbusiness',
    'dentist','autorepair','realestateagent','foodestablishment','lodgingbusiness'];
  const hasLocalBusiness = new RegExp('"@type"\\s*:\\s*"?(' + localTypes.join('|') + ')"?', 'i').test(ldJoined);
  const hasOrganization = /"@type"\s*:\s*"?organization"?/i.test(ldJoined);
  const hasPostalAddress = ldJoined.includes('postaladdress') || ldJoined.includes('"address"');
  const hasGeo = ldJoined.includes('"geo"') || ldJoined.includes('geocoordinates');

  // Require a tel: link or a properly separated phone number, so random digit
  // runs (IDs, coordinates, hashes) are not mistaken for a phone number.
  const hasTelLink = /href=["']tel:/i.test(html);
  const hasFormattedPhone = /\(\d{3}\)\s?\d{3}[\s.-]?\d{4}|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b|\+\d{1,3}[\s().-]?\d{2,4}[\s().-]?\d{2,4}[\s().-]?\d{2,4}/.test(html);
  const hasPhone = hasTelLink || hasFormattedPhone;
  const hasMapEmbed = lower.includes('google.com/maps') || lower.includes('maps.google') ||
    lower.includes('goo.gl/maps') || lower.includes('g.page') || lower.includes('maps.app.goo.gl');

  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title, titleLen: title.length, metaDesc, metaDescLen: metaDesc.length,
    viewport, h1Count, canonical, ogTitle, ogImage, metaRobotsNoindex,
    hasSchema, hasLocalBusiness, hasOrganization, hasPostalAddress, hasGeo,
    hasPhone, hasMapEmbed, textLen: textOnly.length,
    isHttps: finalUrl.startsWith('https://'),
  };
}

function parseRobots(robotsTxt) {
  const out = { fetched: !!robotsTxt, hasSitemap: false, aiCrawlers: {}, wildcardBlocksAll: false };
  const bots = ['GPTBot', 'Google-Extended', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'CCBot'];
  if (!robotsTxt) { bots.forEach((b) => { out.aiCrawlers[b] = 'allowed'; }); return out; }
  out.hasSitemap = /^\s*sitemap\s*:/im.test(robotsTxt);

  // Consecutive User-agent lines share ONE rule set (per the robots standard),
  // so a new group starts only at the first agent line after a rule.
  const groups = [];
  let current = null;
  let lastLineWasAgent = false;
  robotsTxt.split(/\r?\n/).forEach((raw) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const ua = line.match(/^user-agent\s*:\s*(.+)$/i);
    if (ua) {
      if (!current || !lastLineWasAgent) {
        if (current) groups.push(current);
        current = { agents: [], rules: [] };
      }
      current.agents.push(ua[1].trim().toLowerCase());
      lastLineWasAgent = true;
      return;
    }
    if (!current) return;
    lastLineWasAgent = false;
    const da = line.match(/^disallow\s*:\s*(.*)$/i);
    if (da) { current.rules.push({ type: 'disallow', path: da[1].trim() }); return; }
    const al = line.match(/^allow\s*:\s*(.*)$/i);
    if (al) { current.rules.push({ type: 'allow', path: al[1].trim() }); }
  });
  if (current) groups.push(current);

  const isRoot = (path) => path === '/' || path === '/*';
  // A group blocks the whole site when it disallows the root and does not
  // re-open it with an equally broad Allow.
  const blocksEverything = (group) => {
    if (!group) return false;
    if (group.rules.some((r) => r.type === 'allow' && isRoot(r.path))) return false;
    return group.rules.some((r) => r.type === 'disallow' && isRoot(r.path));
  };
  const groupFor = (agent) => groups.find((g) => g.agents.includes(agent));

  const wildcard = groupFor('*');
  out.wildcardBlocksAll = blocksEverything(wildcard);

  bots.forEach((bot) => {
    // Most specific match wins; "*" applies only when the bot has no group of
    // its own. This is what makes "User-agent: * / Disallow: /" register.
    const governing = groupFor(bot.toLowerCase()) || wildcard;
    out.aiCrawlers[bot] = blocksEverything(governing) ? 'blocked' : 'allowed';
  });
  return out;
}

/* ---------- deterministic report ---------- */
// status: pass | warn | fail | info. Only pass/warn/fail count toward the score.
function f(status, label, detail, weight, fix) {
  return { status, label, detail: detail || '', weight: weight || 0, fix: fix || null };
}

function categoryScore(findings) {
  let total = 0, got = 0;
  findings.forEach((x) => {
    if (!x.weight || x.status === 'info') return;
    total += x.weight;
    got += x.weight * (x.status === 'pass' ? 1 : x.status === 'warn' ? 0.5 : 0);
  });
  return total ? Math.round((got / total) * 100) : 100;
}

function buildReport(s, robots) {
  const findability = [
    !s.title
      ? f('fail', 'No <title> tag found', '', 3, { priority: 'high', title: 'Add a page title', why: 'No <title> tag was found in your homepage HTML.' })
      : (s.titleLen < 15 || s.titleLen > 65)
        ? f('warn', 'Title tag present but ' + (s.titleLen > 65 ? 'long' : 'short'), s.titleLen + ' characters', 3, { priority: 'medium', title: 'Tune your title length', why: 'Your title is ' + s.titleLen + ' characters; aim for roughly 15 to 65 so it is not truncated in results.' })
        : f('pass', 'Title tag present', s.titleLen + ' characters', 3),
    !s.metaDesc
      ? f('fail', 'No meta description found', '', 3, { priority: 'medium', title: 'Add a meta description', why: 'No meta description tag was found in your homepage HTML. It is often used as the snippet shown in search results.' })
      : (s.metaDescLen < 50 || s.metaDescLen > 160)
        ? f('warn', 'Meta description present but ' + (s.metaDescLen > 160 ? 'long' : 'short'), s.metaDescLen + ' characters', 2, { priority: 'low', title: 'Tune your meta description length', why: 'Your meta description is ' + s.metaDescLen + ' characters; aim for roughly 50 to 160.' })
        : f('pass', 'Meta description present', s.metaDescLen + ' characters', 2),
    s.metaRobotsNoindex
      ? f('fail', 'Page has a noindex tag', 'Asks search engines not to index this page', 3, { priority: 'high', title: 'Remove the noindex tag', why: 'Your homepage HTML contains a robots noindex tag, which tells search engines not to index it.' })
      : f('pass', 'No noindex tag found', '', 3),
    s.canonical ? f('pass', 'Canonical URL set', '', 1) : f('info', 'No canonical tag found', ''),
  ];

  const local = [
    s.hasLocalBusiness
      ? f('pass', 'LocalBusiness structured data found', '', 3)
      : s.hasOrganization
        ? f('warn', 'Organization schema found, but no LocalBusiness schema', '', 3, { priority: 'medium', title: 'Add LocalBusiness structured data', why: 'Your HTML has Organization schema but no LocalBusiness type, which is what search and AI engines use to confirm a local business.' })
        : f('fail', 'No business structured data found', '', 3, { priority: 'high', title: 'Add LocalBusiness structured data', why: 'No LocalBusiness or Organization schema was found in your homepage HTML.' }),
    s.hasPostalAddress ? f('pass', 'Postal address in structured data', '', 1)
      : f('warn', 'No postal address in structured data', '', 1, { priority: 'medium', title: 'Add your address to structured data', why: 'No postal address was found in your page schema.' }),
    s.hasGeo ? f('pass', 'Geo coordinates in structured data', '', 1) : f('info', 'No geo coordinates in structured data', ''),
    s.hasPhone ? f('pass', 'Phone number found in page HTML', '', 1)
      : f('warn', 'No phone number found in the served HTML', '', 1, { priority: 'medium', title: 'Show your phone number in the page', why: 'No phone-number pattern was found in your homepage HTML.' }),
    s.hasMapEmbed ? f('pass', 'Map or Google Business link found', '', 1) : f('info', 'No Google Map or Business Profile link found', ''),
  ];

  const blockedBots = Object.entries(robots.aiCrawlers).filter(([, v]) => v === 'blocked').map(([k]) => k);
  const aiReady = [
    blockedBots.length
      ? f('fail',
          robots.wildcardBlocksAll ? 'robots.txt blocks all crawlers' : 'robots.txt blocks AI crawlers',
          robots.wildcardBlocksAll
            ? 'A "User-agent: *" rule disallows the whole site, which includes ' + blockedBots.join(', ')
            : 'Blocked: ' + blockedBots.join(', '),
          3,
          { priority: 'high', title: 'Allow AI search crawlers',
            why: robots.wildcardBlocksAll
              ? 'Your robots.txt disallows the entire site for all crawlers ("User-agent: *" with "Disallow: /"), so search and AI engines cannot read any of it.'
              : 'Your robots.txt blocks ' + blockedBots.join(', ') + ', so these engines cannot read your site.' })
      : f('pass', 'AI crawlers are allowed', robots.fetched ? 'GPTBot, ClaudeBot, PerplexityBot, etc. not blocked' : 'No robots.txt found, so nothing is blocked', 3),
    s.hasSchema ? f('pass', 'Structured data present', 'Helps AI engines parse your content', 2)
      : f('warn', 'No structured data found', '', 2, { priority: 'medium', title: 'Add structured data', why: 'No JSON-LD structured data was found in your homepage HTML.' }),
    s.textLen >= 600 ? f('pass', 'Readable text present in HTML', s.textLen + ' characters', 2)
      : f('warn', 'Little readable text in the served HTML', s.textLen + ' characters (JavaScript-rendered text is not counted)', 2, { priority: 'low', title: 'Verify your text is in the HTML', why: 'Only ' + s.textLen + ' characters of text were in the served HTML. If your site renders text with JavaScript, AI crawlers that do not run JS may miss it.' }),
    (s.ogTitle && s.ogImage) ? f('pass', 'Open Graph tags present', '', 1) : f('info', 'Some Open Graph tags missing', ''),
  ];

  const technical = [
    s.isHttps ? f('pass', 'Served over HTTPS', '', 3)
      : f('fail', 'Not served over HTTPS', '', 3, { priority: 'high', title: 'Switch to HTTPS', why: 'Your site was not served over a secure HTTPS connection.' }),
    s.viewport ? f('pass', 'Mobile viewport tag present', '', 2)
      : f('fail', 'No mobile viewport tag', '', 2, { priority: 'high', title: 'Add a mobile viewport tag', why: 'No <meta name="viewport"> was found, so the page may not be mobile-friendly.' }),
    s.h1Count === 1 ? f('pass', 'One <h1> heading found', '', 2)
      : s.h1Count > 1 ? f('warn', 'Multiple <h1> headings found', s.h1Count + ' found', 2, { priority: 'low', title: 'Use a single <h1>', why: s.h1Count + ' <h1> headings were found in the served HTML; one primary heading is clearest.' })
      : f('warn', 'No <h1> found in the served HTML', 'Not detected if added via JavaScript', 2, { priority: 'medium', title: 'Check your <h1> heading', why: 'No <h1> heading was found in the served HTML. If your site renders content with JavaScript, confirm the rendered page has one.' }),
  ];

  const categories = [
    { name: 'Findability', detail: 'Can search engines index and understand the served HTML', score: categoryScore(findability), findings: strip(findability) },
    { name: 'Local signals', detail: 'Business name, address, phone, and local schema', score: categoryScore(local), findings: strip(local) },
    { name: 'AI search readiness', detail: 'Whether AI engines can crawl and parse you', score: categoryScore(aiReady), findings: strip(aiReady) },
    { name: 'Technical basics', detail: 'HTTPS, mobile, and clean page structure', score: categoryScore(technical), findings: strip(technical) },
  ];

  const overall = Math.round(
    categories[0].score * 0.3 + categories[1].score * 0.3 + categories[2].score * 0.25 + categories[3].score * 0.15
  );

  const order = { high: 0, medium: 1, low: 2 };
  const fixes = [...findability, ...local, ...aiReady, ...technical]
    .filter((x) => x.fix)
    .map((x) => x.fix)
    .sort((a, b) => order[a.priority] - order[b.priority]);

  return {
    score: overall,
    grade: overall >= 90 ? 'A' : overall >= 80 ? 'B' : overall >= 70 ? 'C' : overall >= 55 ? 'D' : 'F',
    categories,
    fixes,
  };
}

function strip(findings) {
  return findings.map(({ status, label, detail }) => ({ status, label, detail }));
}

// Detect when we were served a block / bot-challenge page instead of the real
// site (common with Cloudflare etc.), so we never report on the wrong page.
function blockedMessage(page) {
  if (page.status === 0) return 'We could not reach that website. Check the address and try again.';
  if ([401, 403, 407, 408, 429, 451, 503].includes(page.status)) {
    return 'This site blocked our automated check (HTTP ' + page.status + '). Sites behind Cloudflare or similar bot protection often cannot be scanned this way.';
  }
  const head = page.text.slice(0, 4000).toLowerCase();
  const markers = ['just a moment', 'attention required', 'access denied', '/cdn-cgi/challenge-platform',
    'cf-browser-verification', 'verify you are human', 'are you a robot', 'checking your browser before',
    'enable javascript and cookies to continue', 'ddos protection by'];
  if (markers.some((m) => head.includes(m))) {
    return 'This site returned a security/verification page instead of its content, so we could not read it. Sites behind Cloudflare or similar bot protection often cannot be scanned this way.';
  }
  return null;
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

  let [page, robotsRes] = await Promise.all([
    fetchText(target.href, 'text/html'),
    fetchText(new URL('/robots.txt', target.origin).href, 'text/plain'),
  ]);

  // If the site redirected to a different host, the robots.txt we fetched
  // belongs to the wrong origin — re-fetch it from where we actually landed.
  let finalOrigin = target.origin;
  try { finalOrigin = new URL(page.finalUrl).origin; } catch (_) {}
  if (page.text && finalOrigin !== target.origin) {
    robotsRes = await fetchText(new URL('/robots.txt', finalOrigin).href, 'text/plain');
  }

  const blocked = page.error === 'Blocked host'
    ? 'That address points to a private or internal network, so we did not fetch it.'
    : page.error === 'Unresolved host'
      ? 'We could not look up that domain name. Check the spelling and try again.'
      : !page.text
      ? 'We could not reach that website. Check the address and try again.'
      : blockedMessage(page);
  if (blocked) {
    return res.status(200).json({ ok: false, reachable: false, url: target.href, message: blocked });
  }

  const signals = analyzeHtml(page.text, page.finalUrl);
  const robots = parseRobots(robotsRes.ok ? robotsRes.text : '');
  const report = buildReport(signals, robots);

  // Low-confidence: the page came back but is suspiciously thin (almost no
  // readable text AND no <h1>). This usually means we received a stripped or
  // partial response (some hosts serve datacenter IPs a degraded page) or the
  // content is rendered with JavaScript. Flag it rather than scoring it as fact.
  const lowConfidence = signals.textLen < 1000 && signals.h1Count === 0;
  const confidenceNote = lowConfidence
    ? 'We received very little content from this site, so this report may be incomplete. Some sites serve automated tools a limited version of the page, or build their content with JavaScript that this tool does not run. Treat these results with caution.'
    : '';

  return res.status(200).json({
    ok: true,
    reachable: true,
    url: page.finalUrl,
    checkedAt: new Date().toISOString(),
    method: METHOD_NOTE,
    lowConfidence,
    confidenceNote,
    ...report,
  });
}
