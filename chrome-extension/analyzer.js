// ═══════════════════════════════════════════════
// GEO + JSON-LD Analysis Engine v2
// ═══════════════════════════════════════════════

const RULES_URL = 'https://kyangkyongkyungkyang.github.io/jsonld-analyzer/rules.json';
const RULES_CACHE_KEY = 'geo_rules_cache';
const RULES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// ── Remote rules loader ──
async function loadRemoteRules() {
  try {
    const cached = localStorage.getItem(RULES_CACHE_KEY);
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < RULES_CACHE_TTL) return data;
    }
    const resp = await fetch(RULES_URL, { cache: 'no-cache' });
    if (resp.ok) {
      const data = await resp.json();
      localStorage.setItem(RULES_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      return data;
    }
  } catch {}
  return null; // fallback to built-in SCHEMA_RULES
}

// ── Helpers ──
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
  if (score >= 90) return { g: 'A+', t: '우수 — 리치 결과 최적화', cls: 'green' };
  if (score >= 80) return { g: 'A', t: '양호 — 소폭 개선 필요', cls: 'green' };
  if (score >= 70) return { g: 'B+', t: '보통 — 권장 속성 보완', cls: 'amber' };
  if (score >= 60) return { g: 'B', t: '미흡 — 개선 권장', cls: 'amber' };
  if (score >= 50) return { g: 'C', t: '부족 — 필수 항목 보완 필요', cls: 'amber' };
  if (score >= 30) return { g: 'D', t: '매우 부족', cls: 'red' };
  return { g: 'F', t: '심각 — 대폭 수정 필요', cls: 'red' };
}

// ══════════════════════════
// JSON-LD VALIDATION
// ══════════════════════════
function validateJsonLd(jsonlds, rules) {
  const issues = [];
  const typeResults = [];

  jsonlds.forEach((ld, idx) => {
    const type = getType(ld);
    const r = (rules || SCHEMA_RULES)[type];
    typeResults.push({ type, label: r?.label || type, supported: !!r });

    if (!r) {
      issues.push({ sev: 'info', text: `"${type}" — 지원 타입 아님`, cat: 'jsonld' });
      return;
    }

    // @context
    if (!ld['@context'] || !String(ld['@context']).includes('schema.org')) {
      issues.push({ sev: 'error', text: '<code>@context</code> 누락 또는 잘못됨', cat: 'jsonld' });
    }

    // Required
    (r.required || []).forEach(f => {
      if (!hasField(ld, f)) {
        issues.push({ sev: 'error', text: `필수 속성 누락: <code>${f}</code>`, desc: `${r.label}에서 필수`, cat: 'jsonld' });
      } else {
        issues.push({ sev: 'pass', text: `<code>${f}</code> 존재`, cat: 'jsonld' });
      }
    });

    // Recommended
    (r.recommended || []).forEach(f => {
      if (!hasField(ld, f)) {
        issues.push({ sev: 'warn', text: `권장 속성 누락: <code>${f}</code>`, cat: 'jsonld' });
      }
    });

    // Nested
    ['offers','author','publisher','address','mainEntity','itemListElement','acceptedAnswer'].forEach(nested => {
      const rk = `${nested}_required`;
      if (r[rk] && hasField(ld, nested)) {
        const items = Array.isArray(ld[nested]) ? ld[nested] : [ld[nested]];
        items.forEach(item => {
          (r[rk] || []).forEach(f => {
            if (!hasField(item, f)) {
              issues.push({ sev: 'error', text: `<code>${nested}.${f}</code> 누락`, cat: 'jsonld' });
            }
          });
        });
      }
    });

    // Image relative URL
    if (ld.image && typeof ld.image === 'string' && !ld.image.startsWith('http')) {
      issues.push({ sev: 'warn', text: '이미지 URL이 상대 경로', cat: 'jsonld' });
    }
  });

  return { issues, typeResults };
}

// ══════════════════════════
// GEO ANALYSIS
// ══════════════════════════
function analyzeGeo(data) {
  const issues = [];
  const { meta, headings, content } = data;

  // ── META TAGS ──
  const metaChecks = [
    { key: 'title', label: 'Title', req: true },
    { key: 'description', label: 'Meta Description', req: true },
    { key: 'canonical', label: 'Canonical URL', req: true },
    { key: 'ogTitle', label: 'og:title', req: false },
    { key: 'ogDescription', label: 'og:description', req: false },
    { key: 'ogImage', label: 'og:image', req: false },
    { key: 'twitterCard', label: 'twitter:card', req: false },
    { key: 'viewport', label: 'Viewport', req: true },
    { key: 'lang', label: 'HTML lang 속성', req: true },
  ];

  metaChecks.forEach(({ key, label, req }) => {
    if (meta[key]) {
      issues.push({ sev: 'pass', text: `${label} 설정됨`, cat: 'meta' });
    } else {
      issues.push({
        sev: req ? 'error' : 'warn',
        text: `${label} ${req ? '누락' : '미설정'}`,
        desc: req ? 'SEO 및 AI 검색엔진 인식에 필수입니다' : '설정하면 소셜/AI 노출이 개선됩니다',
        cat: 'meta'
      });
    }
  });

  // robots 체크
  if (meta.robots) {
    if (meta.robots.includes('noindex')) {
      issues.push({ sev: 'error', text: '<code>noindex</code> 설정됨 — 검색 노출 차단', cat: 'meta' });
    } else {
      issues.push({ sev: 'pass', text: 'robots 태그 정상', cat: 'meta' });
    }
  }

  // Description 길이
  if (meta.description) {
    const len = meta.description.length;
    if (len < 50) {
      issues.push({ sev: 'warn', text: `메타 설명 너무 짧음 (${len}자)`, desc: '50~160자 권장', cat: 'meta' });
    } else if (len > 160) {
      issues.push({ sev: 'warn', text: `메타 설명 너무 김 (${len}자)`, desc: '160자 초과 시 SERP에서 잘림', cat: 'meta' });
    }
  }

  // ── HEADINGS ──
  if (headings.h1.length === 0) {
    issues.push({ sev: 'error', text: 'H1 태그 없음', desc: '페이지당 H1은 1개 필수', cat: 'headings' });
  } else if (headings.h1.length > 1) {
    issues.push({ sev: 'warn', text: `H1 태그 ${headings.h1.length}개 (1개 권장)`, cat: 'headings' });
  } else {
    issues.push({ sev: 'pass', text: 'H1 태그 1개 존재', cat: 'headings' });
  }

  if (headings.hierarchy) {
    issues.push({ sev: 'pass', text: '헤딩 계층 구조 정상', cat: 'headings' });
  } else {
    issues.push({ sev: 'warn', text: '헤딩 계층 건너뛰기 감지', desc: 'H1→H3처럼 H2 없이 건너뛰면 AI 파싱에 불리', cat: 'headings' });
  }

  const totalHeadings = Object.keys(headings).filter(k => k !== 'hierarchy').reduce((s, k) => s + headings[k].length, 0);
  if (totalHeadings < 2) {
    issues.push({ sev: 'warn', text: '헤딩이 거의 없음', desc: '구조화된 헤딩은 AI 인용 가능성을 높입니다', cat: 'headings' });
  }

  // ── E-E-A-T SIGNALS ──
  if (meta.author) {
    issues.push({ sev: 'pass', text: '저자 정보 존재', cat: 'eeat' });
  } else {
    issues.push({ sev: 'warn', text: '저자(author) 메타 없음', desc: 'E-E-A-T 신호 강화에 권장', cat: 'eeat' });
  }

  if (meta.datePublished) {
    issues.push({ sev: 'pass', text: '발행일 존재', cat: 'eeat' });
  } else {
    issues.push({ sev: 'warn', text: '발행일(datePublished) 없음', desc: '콘텐츠 신선도 판단에 사용', cat: 'eeat' });
  }

  if (meta.dateModified) {
    issues.push({ sev: 'pass', text: '수정일 존재', cat: 'eeat' });
  } else {
    issues.push({ sev: 'info', text: '수정일(dateModified) 없음', cat: 'eeat' });
  }

  // ── CONTENT / CITABILITY ──
  if (content.wordCount < 300) {
    issues.push({ sev: 'warn', text: `콘텐츠 분량 부족 (약 ${content.wordCount}자)`, desc: '300자 이상 권장, AI 인용 가능성 낮음', cat: 'content' });
  } else if (content.wordCount >= 1000) {
    issues.push({ sev: 'pass', text: `충분한 콘텐츠 분량 (약 ${content.wordCount}자)`, cat: 'content' });
  } else {
    issues.push({ sev: 'pass', text: `콘텐츠 분량 적절 (약 ${content.wordCount}자)`, cat: 'content' });
  }

  // Images
  if (content.imageCount === 0) {
    issues.push({ sev: 'warn', text: '이미지 없음', desc: '시각 콘텐츠는 AI 요약에 포함 가능', cat: 'content' });
  } else {
    const altRatio = content.imageCount > 0 ? Math.round(content.imagesWithAlt / content.imageCount * 100) : 0;
    if (altRatio < 80) {
      issues.push({ sev: 'warn', text: `이미지 alt 속성 부족 (${altRatio}%)`, desc: `${content.imageCount}개 중 ${content.imagesWithAlt}개만 alt 있음`, cat: 'content' });
    } else {
      issues.push({ sev: 'pass', text: `이미지 alt 속성 양호 (${altRatio}%)`, cat: 'content' });
    }
  }

  // Lists & Tables (citability)
  if (content.lists > 0 || content.tables > 0) {
    issues.push({ sev: 'pass', text: `구조화 콘텐츠: 리스트 ${content.lists}개, 테이블 ${content.tables}개`, desc: 'AI가 인용하기 좋은 구조', cat: 'content' });
  } else {
    issues.push({ sev: 'info', text: '리스트/테이블 없음', desc: '구조화된 콘텐츠는 AI 인용 확률을 높임', cat: 'content' });
  }

  // FAQ/HowTo
  if (content.hasFaq) {
    issues.push({ sev: 'pass', text: 'FAQ 구조 감지됨', cat: 'content' });
  }
  if (content.hasHowTo) {
    issues.push({ sev: 'pass', text: 'How-To 구조 감지됨', cat: 'content' });
  }

  // Links
  if (content.externalLinks > 0) {
    issues.push({ sev: 'pass', text: `외부 링크 ${content.externalLinks}개 (출처 신뢰도 신호)`, cat: 'content' });
  } else {
    issues.push({ sev: 'info', text: '외부 링크 없음', desc: '신뢰할 수 있는 출처 링크는 E-E-A-T에 긍정적', cat: 'content' });
  }

  return issues;
}

// ══════════════════════════
// SCORING
// ══════════════════════════
function calculateOverallScores(jsonldIssues, geoIssues, jsonlds) {
  function catScore(issues) {
    const errors = issues.filter(i => i.sev === 'error').length;
    const warns = issues.filter(i => i.sev === 'warn').length;
    const passes = issues.filter(i => i.sev === 'pass').length;
    const total = errors + warns + passes || 1;
    return Math.max(0, Math.min(100, Math.round(100 - (errors / total) * 120 - (warns / total) * 40)));
  }

  const jsonldScore = jsonlds.length > 0 ? catScore(jsonldIssues) : 0;
  const metaScore = catScore(geoIssues.filter(i => i.cat === 'meta'));
  const headingScore = catScore(geoIssues.filter(i => i.cat === 'headings'));
  const eeatScore = catScore(geoIssues.filter(i => i.cat === 'eeat'));
  const contentScore = catScore(geoIssues.filter(i => i.cat === 'content'));

  // Weights
  const w = { jsonld: 0.30, meta: 0.20, headings: 0.10, eeat: 0.15, content: 0.25 };
  const overall = Math.round(
    jsonldScore * w.jsonld + metaScore * w.meta + headingScore * w.headings +
    eeatScore * w.eeat + contentScore * w.content
  );

  return {
    overall: Math.min(100, overall),
    bars: [
      { label: 'JSON-LD', score: jsonldScore },
      { label: '메타태그', score: metaScore },
      { label: '헤딩구조', score: headingScore },
      { label: 'E-E-A-T', score: eeatScore },
      { label: '콘텐츠', score: contentScore },
    ]
  };
}

// ══════════════════════════
// AI RECOMMENDATIONS
// ══════════════════════════
function buildRecommendations(jsonlds, jsonldIssues, geoIssues, scores) {
  const recs = [];
  const types = jsonlds.map(getType);

  // Type-specific tips
  types.forEach(type => {
    const r = SCHEMA_RULES[type];
    if (r?.tips) {
      const shuffled = [...r.tips].sort(() => 0.5 - Math.random());
      recs.push(shuffled[0]);
    }
  });

  // Score-based
  if (scores.bars[0].score < 50 && jsonlds.length > 0) {
    recs.unshift('<strong>JSON-LD 필수 속성부터 채우세요.</strong> 필수 속성 없이는 리치 결과가 표시되지 않습니다.');
  }
  if (scores.bars[1].score < 60) {
    recs.push('<strong>메타태그를 완성하세요.</strong> title, description, og:* 태그는 AI 검색엔진 인식의 기본입니다.');
  }
  if (scores.bars[3].score < 60) {
    recs.push('<strong>E-E-A-T 신호를 강화하세요.</strong> 저자 정보, 발행일, 전문성 표시가 AI 검색에서 중요합니다.');
  }

  // GEO specific
  const hasNoList = geoIssues.some(i => i.text.includes('리스트/테이블 없음'));
  if (hasNoList) {
    recs.push('<strong>리스트나 테이블을 추가하세요.</strong> AI 검색엔진이 구조화된 정보를 인용할 확률이 높습니다.');
  }

  if (jsonlds.length === 0) {
    recs.push('<strong>JSON-LD 구조화 데이터를 추가하세요.</strong> Google 리치 결과의 기본 조건입니다.');
  }

  if (!types.includes('BreadcrumbList') && jsonlds.length > 0) {
    recs.push('<strong>BreadcrumbList 추가를 권장합니다.</strong> 거의 모든 페이지에 적용 가능합니다.');
  }

  recs.push('<strong>Google Rich Results Test로 최종 검증하세요.</strong>');
  return [...new Set(recs)].slice(0, 5);
}

// ── Syntax highlighting ──
function syntaxHighlight(json) {
  return json.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?/g, m => {
      if (/:$/.test(m)) return `<span class="jk">${m}</span>`;
      return `<span class="js">${m}</span>`;
    })
    .replace(/\b(true|false)\b/g, '<span class="jb">$&</span>')
    .replace(/\bnull\b/g, '<span class="jl">$&</span>')
    .replace(/\b\d+\.?\d*\b/g, '<span class="jn">$&</span>')
    .replace(/[{}\[\]]/g, '<span class="jbr">$&</span>');
}
