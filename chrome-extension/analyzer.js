// ═══════════════════════════════════════════════
// GEO + JSON-LD Analysis Engine v2
// ═══════════════════════════════════════════════

const RULES_URL = 'https://kyangkyongkyungkyang.github.io/jsonld-analyzer/rules.json';
const RULES_CACHE_KEY = 'geo_rules_cache';
const RULES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// ── Remote rules loader ──
// chrome.storage.local 사용 (popup localStorage는 세션 스코프라 캐시 효과 불안정)
async function loadRemoteRules(forceRefresh) {
  try {
    if (!forceRefresh && typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(RULES_CACHE_KEY);
      const cached = result[RULES_CACHE_KEY];
      if (cached) {
        const { data, ts } = cached;
        if (Date.now() - ts < RULES_CACHE_TTL) return data;
      }
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(RULES_URL, { cache: 'no-cache', signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      // 스키마 검증: 최소 구조 확인
      if (!data || typeof data.schemaRules !== 'object' || !data.version) {
        console.warn('[GEO Analyzer] 원격 규칙 스키마 불일치, 내장 규칙 사용');
        return null;
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [RULES_CACHE_KEY]: { data, ts: Date.now() } });
      }
      return data;
    }
    console.warn('[GEO Analyzer] 규칙 fetch 실패:', resp.status);
  } catch (e) {
    console.warn('[GEO Analyzer] 원격 규칙 로딩 실패, 내장 규칙 사용:', e.message);
  }
  return null; // fallback to built-in SCHEMA_RULES
}

// ── i18n helper ──
function msg(key, ...subs) {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const result = chrome.i18n.getMessage(key, subs.length ? subs.map(String) : undefined);
    if (result) return result;
  }
  return key; // fallback
}

// ── Helpers ──
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// 허용 태그만 남기고 나머지 HTML 태그 제거 (remote rules tips 새니타이징용)
function sanitizeHtml(str) {
  return String(str).replace(/<(?!\/?(?:strong|code|em|b|br)\b)[^>]*>/gi, '');
}
function getType(ld) {
  let t = ld['@type'];
  if (Array.isArray(t)) t = t[0];
  return t || 'Unknown';
}
function hasField(obj, field) {
  if (!obj) return false;
  return obj[field] !== undefined && obj[field] !== null && obj[field] !== '';
}
function getScoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 50) return 'var(--amber)';
  return 'var(--red)';
}
function getGrade(score) {
  if (score >= 90) return { g: 'A+', t: msg('gradeApPlus'), cls: 'green' };
  if (score >= 80) return { g: 'A', t: msg('gradeA'), cls: 'green' };
  if (score >= 70) return { g: 'B+', t: msg('gradeBPlus'), cls: 'amber' };
  if (score >= 60) return { g: 'B', t: msg('gradeB'), cls: 'amber' };
  if (score >= 50) return { g: 'C', t: msg('gradeC'), cls: 'amber' };
  if (score >= 30) return { g: 'D', t: msg('gradeD'), cls: 'red' };
  return { g: 'F', t: msg('gradeF'), cls: 'red' };
}

// ══════════════════════════
// JSON-LD VALIDATION
// ══════════════════════════
// 내장 폴백 (remote rules 로딩 실패 시)
const FALLBACK_TYPE_MAP = {
  BlogPosting: 'Article', NewsArticle: 'Article', TechArticle: 'Article', ScholarlyArticle: 'Article',
  Restaurant: 'LocalBusiness', Hotel: 'LocalBusiness', Store: 'LocalBusiness',
  Corporation: 'Organization', NGO: 'Organization',
  MobileApplication: 'SoftwareApplication', WebApplication: 'SoftwareApplication',
};

// remoteRules가 있으면 typeFallback 사용, 없으면 내장 폴백
let _typeFallback = null;
function getTypeFallback(remoteRules) {
  if (remoteRules?.typeFallback) return remoteRules.typeFallback;
  return FALLBACK_TYPE_MAP;
}

function validateJsonLd(jsonlds, rules, remoteRules) {
  const issues = [];
  const typeResults = [];
  const rulesMap = rules || SCHEMA_RULES;
  const fallback = getTypeFallback(remoteRules);

  jsonlds.forEach((ld, idx) => {
    const type = getType(ld);
    const isFallback = !rulesMap[type] && !!fallback[type];
    const r = rulesMap[type] || rulesMap[fallback[type]];
    const safeType = escHtml(type);
    const tl = escHtml(r?.label || type);
    typeResults.push({ type: safeType, label: tl, supported: !!r, isFallback });

    if (!r) {
      issues.push({ sev: 'info', text: msg('unsupportedType', safeType), desc: msg('unsupportedTypeDesc'), cat: 'jsonld', typeLabel: safeType });
      return;
    }

    // @context
    if (!ld['@context'] || !String(ld['@context']).includes('schema.org')) {
      issues.push({ sev: 'error', text: msg('missingContext'), desc: msg('missingContextDesc'), cat: 'jsonld', typeLabel: tl });
    }

    // Required
    (r.required || []).forEach(f => {
      const sf = escHtml(f);
      if (!hasField(ld, f)) {
        issues.push({ sev: 'error', text: msg('requiredMissing', sf), desc: msg('requiredMissingDesc', tl), cat: 'jsonld', typeLabel: tl });
      } else {
        issues.push({ sev: 'pass', text: msg('fieldExists', sf), cat: 'jsonld', typeLabel: tl });
      }
    });

    // Recommended
    (r.recommended || []).forEach(f => {
      if (!hasField(ld, f)) {
        issues.push({ sev: 'warn', text: msg('recommendedMissing', escHtml(f)), desc: msg('recommendedMissingDesc'), cat: 'jsonld', typeLabel: tl });
      }
    });

    // Nested — rules에서 *_required 키를 동적 추출 (하드코딩 불필요)
    const nestedFields = new Set();
    // flat 구조 (rules.js): offers_required, author_required 등
    for (const k of Object.keys(r)) {
      if (k.endsWith('_required')) nestedFields.add(k.replace('_required', ''));
    }
    // nested 구조 (rules.json): nested.offers_required 등
    if (r.nested) {
      for (const k of Object.keys(r.nested)) {
        if (k.endsWith('_required')) nestedFields.add(k.replace('_required', ''));
      }
    }
    nestedFields.forEach(nested => {
      const rk = `${nested}_required`;
      const nestedRule = r[rk] || r.nested?.[rk];
      if (nestedRule && hasField(ld, nested)) {
        const items = Array.isArray(ld[nested]) ? ld[nested] : [ld[nested]];
        items.forEach(item => {
          (nestedRule || []).forEach(f => {
            if (!hasField(item, f)) {
              issues.push({ sev: 'error', text: msg('nestedMissing', `${escHtml(nested)}.${escHtml(f)}`), desc: msg('nestedMissingDesc'), cat: 'jsonld', typeLabel: tl });
            }
          });
        });
      }
    });

    // Image relative URL
    if (ld.image && typeof ld.image === 'string' && !ld.image.startsWith('http')) {
      issues.push({ sev: 'warn', text: msg('imageRelative'), desc: msg('imageRelativeDesc'), cat: 'jsonld', typeLabel: tl });
    }
  });

  return { issues, typeResults };
}

// ══════════════════════════
// GEO ANALYSIS
// ══════════════════════════
// 내장 폴백 설정
const FALLBACK_CONFIG = {
  metaDescription: { minLength: 50, maxLength: 160 },
  content: { minWords: 300, goodWords: 1000, altTextMinPercent: 80, minHeadings: 2 },
  metaChecks: [
    { key: 'title', label: 'Title', req: true },
    { key: 'description', label: 'Meta Description', req: true },
    { key: 'canonical', label: 'Canonical URL', req: true },
    { key: 'ogTitle', label: 'og:title', req: false },
    { key: 'ogDescription', label: 'og:description', req: false },
    { key: 'ogImage', label: 'og:image', req: false },
    { key: 'twitterCard', label: 'twitter:card', req: false },
    { key: 'viewport', label: 'Viewport', req: true },
    { key: 'lang', label: 'HTML lang', req: true },
  ]
};

function analyzeGeo(data, remoteRules) {
  const issues = [];
  const { meta, headings, content } = data;
  const cfg = remoteRules?.analysisConfig || FALLBACK_CONFIG;
  const metaChecks = cfg.metaChecks || FALLBACK_CONFIG.metaChecks;
  const descCfg = cfg.metaDescription || FALLBACK_CONFIG.metaDescription;
  const contentCfg = cfg.content || FALLBACK_CONFIG.content;

  metaChecks.forEach(({ key, label, req }) => {
    if (meta[key]) {
      issues.push({ sev: 'pass', text: msg('metaSet', label), cat: 'meta' });
    } else {
      issues.push({
        sev: req ? 'error' : 'warn',
        text: req ? msg('metaMissing', label) : msg('metaNotSet', label),
        desc: req ? msg('metaRequiredDesc') : msg('metaOptionalDesc'),
        cat: 'meta'
      });
    }
  });

  if (meta.robots) {
    if (meta.robots.includes('noindex')) {
      issues.push({ sev: 'error', text: msg('noindexSet'), cat: 'meta' });
    } else {
      issues.push({ sev: 'pass', text: msg('robotsOk'), cat: 'meta' });
    }
  }

  if (meta.description) {
    const len = meta.description.length;
    if (len < descCfg.minLength) {
      issues.push({ sev: 'warn', text: msg('descTooShort', len), desc: msg('descTooShortTip'), cat: 'meta' });
    } else if (len > descCfg.maxLength) {
      issues.push({ sev: 'warn', text: msg('descTooLong', len), desc: msg('descTooLongTip'), cat: 'meta' });
    }
  }

  if (headings.h1.length === 0) {
    issues.push({ sev: 'error', text: msg('h1None'), desc: msg('h1NoneDesc'), cat: 'headings' });
  } else if (headings.h1.length > 1) {
    issues.push({ sev: 'warn', text: msg('h1Multiple', headings.h1.length), cat: 'headings' });
  } else {
    issues.push({ sev: 'pass', text: msg('h1Ok'), cat: 'headings' });
  }

  if (headings.hierarchy) {
    issues.push({ sev: 'pass', text: msg('headingHierarchyOk'), cat: 'headings' });
  } else {
    issues.push({ sev: 'warn', text: msg('headingHierarchyBad'), desc: msg('headingHierarchyBadDesc'), cat: 'headings' });
  }

  const totalHeadings = Object.keys(headings).filter(k => k !== 'hierarchy').reduce((s, k) => s + headings[k].length, 0);
  if (totalHeadings < contentCfg.minHeadings) {
    issues.push({ sev: 'warn', text: msg('headingsTooFew'), desc: msg('headingsTooFewDesc'), cat: 'headings' });
  }

  if (meta.author) {
    issues.push({ sev: 'pass', text: msg('authorExists'), cat: 'eeat' });
  } else {
    issues.push({ sev: 'warn', text: msg('authorMissing'), desc: msg('authorMissingDesc'), cat: 'eeat' });
  }

  if (meta.datePublished) {
    issues.push({ sev: 'pass', text: msg('datePublishedExists'), cat: 'eeat' });
  } else {
    issues.push({ sev: 'warn', text: msg('datePublishedMissing'), desc: msg('datePublishedMissingDesc'), cat: 'eeat' });
  }

  if (meta.dateModified) {
    issues.push({ sev: 'pass', text: msg('dateModifiedExists'), cat: 'eeat' });
  } else {
    issues.push({ sev: 'info', text: msg('dateModifiedMissing'), cat: 'eeat' });
  }

  if (content.wordCount < contentCfg.minWords) {
    issues.push({ sev: 'warn', text: msg('contentTooShort', content.wordCount), desc: msg('contentTooShortDesc'), cat: 'content' });
  } else if (content.wordCount >= contentCfg.goodWords) {
    issues.push({ sev: 'pass', text: msg('contentGood', content.wordCount), cat: 'content' });
  } else {
    issues.push({ sev: 'pass', text: msg('contentOk', content.wordCount), cat: 'content' });
  }

  if (content.imageCount === 0) {
    issues.push({ sev: 'warn', text: msg('noImages'), desc: msg('noImagesDesc'), cat: 'content' });
  } else {
    const altRatio = content.imageCount > 0 ? Math.round(content.imagesWithAlt / content.imageCount * 100) : 0;
    if (altRatio < contentCfg.altTextMinPercent) {
      issues.push({ sev: 'warn', text: msg('altBad', altRatio), desc: msg('altBadDesc', content.imageCount, content.imagesWithAlt), cat: 'content' });
    } else {
      issues.push({ sev: 'pass', text: msg('altGood', altRatio), cat: 'content' });
    }
  }

  if (content.lists > 0 || content.tables > 0) {
    issues.push({ sev: 'pass', text: msg('structuredContent', content.lists, content.tables), desc: msg('structuredContentDesc'), cat: 'content' });
  } else {
    issues.push({ sev: 'info', text: msg('noStructured'), desc: msg('noStructuredDesc'), cat: 'content' });
  }

  if (content.hasFaq) {
    issues.push({ sev: 'pass', text: msg('faqDetected'), cat: 'content' });
  }
  if (content.hasHowTo) {
    issues.push({ sev: 'pass', text: msg('howtoDetected'), cat: 'content' });
  }

  if (content.externalLinks > 0) {
    issues.push({ sev: 'pass', text: msg('externalLinks', content.externalLinks), cat: 'content' });
  } else {
    issues.push({ sev: 'info', text: msg('noExternalLinks'), desc: msg('noExternalLinksDesc'), cat: 'content' });
  }

  return issues;
}

// ══════════════════════════
// SCORING
// ══════════════════════════
const FALLBACK_WEIGHTS = { jsonld: 0.30, meta: 0.20, headings: 0.10, eeat: 0.15, content: 0.25 };

function calculateOverallScores(jsonldIssues, geoIssues, jsonlds, remoteRules) {
  function catScore(issues) {
    const errors = issues.filter(i => i.sev === 'error').length;
    const warns = issues.filter(i => i.sev === 'warn').length;
    const passes = issues.filter(i => i.sev === 'pass').length;
    const total = errors + warns + passes || 1;
    return Math.max(0, Math.min(100, Math.round(100 - (errors / total) * 120 - (warns / total) * 40)));
  }

  const hasJsonld = jsonlds.length > 0;
  const jsonldScore = hasJsonld ? catScore(jsonldIssues) : 0;
  const metaScore = catScore(geoIssues.filter(i => i.cat === 'meta'));
  const headingScore = catScore(geoIssues.filter(i => i.cat === 'headings'));
  const eeatScore = catScore(geoIssues.filter(i => i.cat === 'eeat'));
  const contentScore = catScore(geoIssues.filter(i => i.cat === 'content'));

  // remote weights 정규화
  // 구버전: { jsonld: { weight: 0.3, label: "..." }, citability: ... }
  // 신버전: { jsonld: 0.3, content: 0.25 }
  const rawW = remoteRules?.scoring?.weights;
  const w = { ...FALLBACK_WEIGHTS };
  if (rawW && typeof rawW === 'object') {
    // citability → content 호환 (구버전 rules.json)
    const keyMap = { citability: 'content', aiCrawling: null };
    for (const [rk, rv] of Object.entries(rawW)) {
      const k = keyMap[rk] !== undefined ? keyMap[rk] : rk;
      if (!k || !(k in FALLBACK_WEIGHTS)) continue;
      if (typeof rv === 'number') w[k] = rv;
      else if (rv?.weight != null) w[k] = Number(rv.weight) || 0;
    }
  }
  // 합계 보정 (aiCrawling 제외 등으로 합계가 1이 아닐 수 있음)
  const wSum = Object.values(w).reduce((a, b) => a + b, 0);
  if (wSum > 0 && Math.abs(wSum - 1) > 0.01) {
    for (const k of Object.keys(w)) w[k] = w[k] / wSum;
  }

  // JSON-LD 없으면 해당 가중치를 나머지에 비례 재분배
  let overall;
  if (!hasJsonld) {
    const restTotal = (w.meta || 0) + (w.headings || 0) + (w.eeat || 0) + (w.content || 0);
    if (restTotal > 0) {
      overall = Math.round(
        metaScore * (w.meta / restTotal) + headingScore * (w.headings / restTotal) +
        eeatScore * (w.eeat / restTotal) + contentScore * (w.content / restTotal)
      );
    } else {
      overall = 0;
    }
  } else {
    overall = Math.round(
      jsonldScore * (w.jsonld || 0) + metaScore * (w.meta || 0) + headingScore * (w.headings || 0) +
      eeatScore * (w.eeat || 0) + contentScore * (w.content || 0)
    );
  }

  // NaN 방어
  if (isNaN(overall)) overall = 0;

  return {
    overall: Math.min(100, Math.max(0, overall)),
    bars: [
      { label: msg('barJsonld'), score: jsonldScore },
      { label: msg('barMeta'), score: metaScore },
      { label: msg('barHeadings'), score: headingScore },
      { label: msg('barEeat'), score: eeatScore },
      { label: msg('barContent'), score: contentScore },
    ]
  };
}

// ══════════════════════════
// AI RECOMMENDATIONS
// ══════════════════════════
function buildRecommendations(jsonlds, jsonldIssues, geoIssues, scores, rules) {
  const recs = [];
  const types = jsonlds.map(getType);
  const rulesLookup = rules || SCHEMA_RULES;

  // Type-specific tips (remote rules 우선, 폴백으로 내장 규칙)
  types.forEach(type => {
    const r = rulesLookup[type];
    if (r?.tips) {
      const shuffled = [...r.tips].sort(() => 0.5 - Math.random());
      // remote rules tips는 새니타이징 (허용: strong, code, em, b, br만)
      recs.push(sanitizeHtml(shuffled[0]));
    }
  });

  if (scores.bars[0].score < 50 && jsonlds.length > 0) {
    recs.unshift(msg('recJsonldFirst'));
  }
  if (scores.bars[1].score < 60) {
    recs.push(msg('recMeta'));
  }
  if (scores.bars[3].score < 60) {
    recs.push(msg('recEeat'));
  }

  const hasNoList = geoIssues.some(i => i.text === msg('noStructured'));
  if (hasNoList) {
    recs.push(msg('recList'));
  }

  if (jsonlds.length === 0) {
    recs.push(msg('recAddJsonld'));
  }

  if (!types.includes('BreadcrumbList') && jsonlds.length > 0) {
    recs.push(msg('recBreadcrumb'));
  }

  recs.push(msg('recGoogleTest'));
  return [...new Set(recs)].slice(0, 5);
}

// ══════════════════════════
// AI CRAWLER ANALYSIS
// ══════════════════════════
// 내장 폴백 목록 (remote rules 로딩 실패 시 사용)
// update-rules.js AI_CRAWLERS seed 목록과 동기화 (2026-03)
const FALLBACK_AI_BOTS = [
  { name: 'GPTBot', label: 'GPTBot (OpenAI)', importance: 'high' },
  { name: 'ChatGPT-User', label: 'ChatGPT Browse (OpenAI)', importance: 'high' },
  { name: 'OAI-SearchBot', label: 'SearchGPT (OpenAI)', importance: 'high' },
  { name: 'ClaudeBot', label: 'ClaudeBot (Anthropic)', importance: 'high' },
  { name: 'Google-Extended', label: 'Google-Extended (Gemini)', importance: 'high' },
  { name: 'GoogleOther', label: 'GoogleOther (Google)', importance: 'medium' },
  { name: 'Googlebot', label: 'Googlebot (Google)', importance: 'high' },
  { name: 'PerplexityBot', label: 'PerplexityBot (Perplexity)', importance: 'high' },
  { name: 'Applebot-Extended', label: 'Applebot-Extended (Apple)', importance: 'high' },
  { name: 'CCBot', label: 'CCBot (Common Crawl)', importance: 'medium' },
  { name: 'Bytespider', label: 'Bytespider (ByteDance)', importance: 'medium' },
  { name: 'FacebookBot', label: 'FacebookBot (Meta)', importance: 'medium' },
  { name: 'Meta-ExternalAgent', label: 'Meta-ExternalAgent (Meta)', importance: 'medium' },
  { name: 'Amazonbot', label: 'Amazonbot (Amazon)', importance: 'medium' },
  { name: 'DeepSeekBot', label: 'DeepSeekBot (DeepSeek)', importance: 'medium' },
  { name: 'YouBot', label: 'YouBot (You.com)', importance: 'medium' },
  { name: 'AI2Bot', label: 'AI2Bot (Allen AI)', importance: 'low' },
  { name: 'Kagibot', label: 'Kagibot (Kagi)', importance: 'low' },
  { name: 'cohere-ai', label: 'Cohere AI', importance: 'low' },
  { name: 'Diffbot', label: 'Diffbot', importance: 'low' },
  { name: 'Timpibot', label: 'Timpibot (Timpi)', importance: 'low' },
  { name: 'ImagesiftBot', label: 'ImagesiftBot (Hive)', importance: 'low' },
  { name: 'PetalBot', label: 'PetalBot (Huawei)', importance: 'low' },
  { name: 'VelenpublicBot', label: 'VelenpublicBot (Velen)', importance: 'low' },
];

// remote rules에서 AI 봇 목록 로딩 (rules.json geoRules.aiCrawling.bots)
function getAiBots(remoteRules) {
  const remoteBots = remoteRules?.geoRules?.aiCrawling?.bots;
  if (!remoteBots || !Array.isArray(remoteBots) || remoteBots.length === 0) return FALLBACK_AI_BOTS;
  // remote bots를 FALLBACK 형식으로 정규화 (필드명 호환)
  return remoteBots.map(b => ({
    name: b.name,
    label: b.label || `${b.name} (${b.org || b.engine || ''})`,
    importance: b.importance || 'low',
  }));
}

function parseRobotsTxt(text) {
  if (!text) return null;
  // 각 user-agent 블록을 파싱하여 { userAgent: string, rules: [{type, path}] }[] 반환
  const blocks = [];
  let current = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const match = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)/i);
    if (!match) continue;
    const [, directive, value] = match;
    const dir = directive.toLowerCase();
    const val = value.trim();
    if (dir === 'user-agent') {
      current = { userAgent: val.toLowerCase(), rules: [] };
      blocks.push(current);
    } else if (current && (dir === 'disallow' || dir === 'allow')) {
      current.rules.push({ type: dir, path: val });
    }
  }
  return blocks;
}

function analyzeCrawlerAccess(robotsTxt, remoteRules) {
  const blocks = parseRobotsTxt(robotsTxt);
  if (!blocks) return { available: false, bots: [] };

  const wildcardBlock = blocks.find(b => b.userAgent === '*');
  const wildcardBlocked = wildcardBlock?.rules.some(r => r.type === 'disallow' && (r.path === '/' || r.path === '/*'));

  const results = getAiBots(remoteRules).map(bot => {
    // 봇 전용 블록 찾기
    const botBlock = blocks.find(b => b.userAgent === bot.name.toLowerCase());

    let status; // 'allowed' | 'blocked' | 'no_rule'
    if (botBlock) {
      // 전용 규칙 있음 — Disallow: / 가 있으면 차단
      const hasDisallowAll = botBlock.rules.some(r => r.type === 'disallow' && (r.path === '/' || r.path === '/*'));
      const hasAllowAll = botBlock.rules.some(r => r.type === 'allow' && r.path === '/');
      const hasEmptyDisallow = botBlock.rules.length === 0 || botBlock.rules.every(r => r.type === 'disallow' && r.path === '');
      if (hasEmptyDisallow || hasAllowAll) {
        status = 'allowed';
      } else if (hasDisallowAll) {
        status = 'blocked';
      } else {
        // 부분 차단 — 일부 경로만 차단된 것은 "allowed"로 분류
        status = 'allowed';
      }
    } else if (wildcardBlocked) {
      status = 'blocked';
    } else {
      status = 'no_rule';
    }

    return { ...bot, status };
  });

  return { available: true, bots: results, wildcardBlocked };
}

