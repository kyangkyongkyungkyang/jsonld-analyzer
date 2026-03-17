// Analysis engine — shared between popup and full version
function getType(ld) {
  let t = ld['@type'];
  if (Array.isArray(t)) t = t[0];
  return t || 'Unknown';
}

function hasField(obj, field) {
  if (!obj) return false;
  return obj[field] !== undefined && obj[field] !== null && obj[field] !== '';
}

function validateSchema(ld, type, rules, idx) {
  const issues = [];
  const prefix = idx > 0 ? `[${idx + 1}] ` : '';

  // Required
  (rules.required || []).forEach(field => {
    if (!hasField(ld, field)) {
      issues.push({ sev: 'error', text: `${prefix}필수 속성 누락: <code>${field}</code>`, desc: `${rules.label}에서 필수입니다.` });
    } else {
      issues.push({ sev: 'pass', text: `${prefix}<code>${field}</code> ✓` });
    }
  });

  // Recommended
  (rules.recommended || []).forEach(field => {
    if (!hasField(ld, field)) {
      issues.push({ sev: 'warn', text: `${prefix}권장 속성 누락: <code>${field}</code>`, desc: '추가하면 리치 결과가 더 풍부해집니다.' });
    }
  });

  // Nested checks
  ['offers','author','publisher','address','mainEntity','itemListElement','acceptedAnswer'].forEach(nested => {
    const reqKey = `${nested}_required`;
    if (rules[reqKey] && hasField(ld, nested)) {
      const items = Array.isArray(ld[nested]) ? ld[nested] : [ld[nested]];
      items.forEach((item, i) => {
        const ip = items.length > 1 ? `${nested}[${i}].` : `${nested}.`;
        (rules[reqKey] || []).forEach(f => {
          if (!hasField(item, f)) {
            issues.push({ sev: 'error', text: `${prefix}중첩 필수 누락: <code>${ip}${f}</code>` });
          }
        });
      });
    }
  });

  // @context check
  if (!ld['@context'] || !String(ld['@context']).includes('schema.org')) {
    issues.push({ sev: 'error', text: `${prefix}<code>@context</code> 누락 또는 잘못됨` });
  }

  // Image relative URL
  if (ld.image && typeof ld.image === 'string' && !ld.image.startsWith('http')) {
    issues.push({ sev: 'warn', text: `${prefix}이미지 URL이 상대 경로 — 절대 URL 권장` });
  }

  return issues;
}

function calculateScores(issues, jsonlds) {
  const errors = issues.filter(i => i.sev === 'error').length;
  const warns = issues.filter(i => i.sev === 'warn').length;
  const passes = issues.filter(i => i.sev === 'pass').length;
  const total = errors + warns + passes || 1;

  const req = Math.max(0, Math.round(100 - (errors / total) * 150));
  const rec = Math.max(0, Math.round(100 - (warns / total) * 100));
  const cov = Math.min(100, jsonlds.length * 25 + (jsonlds.length > 1 ? 20 : 0));
  const qual = Math.max(0, 100 - errors * 20 - warns * 5);
  const overall = Math.min(100, Math.round(req * 0.45 + rec * 0.3 + cov * 0.15 + (errors === 0 ? 15 : 0)));

  return {
    overall, errors, warns, passes,
    bars: [
      { label: '필수', score: req, color: req >= 80 ? 'var(--green)' : req >= 50 ? 'var(--amber)' : 'var(--red)' },
      { label: '권장', score: rec, color: rec >= 80 ? 'var(--green)' : rec >= 50 ? 'var(--amber)' : 'var(--red)' },
      { label: '커버리지', score: cov, color: cov >= 80 ? 'var(--green)' : cov >= 50 ? 'var(--amber)' : 'var(--red)' },
      { label: '품질', score: qual, color: qual >= 80 ? 'var(--green)' : qual >= 50 ? 'var(--amber)' : 'var(--red)' }
    ]
  };
}

function getGrade(score) {
  if (score >= 90) return { g: 'A+', t: '우수' };
  if (score >= 80) return { g: 'A', t: '양호' };
  if (score >= 70) return { g: 'B+', t: '보통' };
  if (score >= 60) return { g: 'B', t: '미흡' };
  if (score >= 50) return { g: 'C', t: '부족' };
  if (score >= 30) return { g: 'D', t: '매우 부족' };
  return { g: 'F', t: '심각' };
}

function getScoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 50) return 'var(--amber)';
  return 'var(--red)';
}

function buildRecommendations(jsonlds, issues, scores) {
  const types = jsonlds.map(getType);
  const recs = [];

  types.forEach(type => {
    const rules = SCHEMA_RULES[type];
    if (rules?.tips) {
      // pick 2 random tips per type
      const shuffled = [...rules.tips].sort(() => 0.5 - Math.random());
      recs.push(...shuffled.slice(0, 2));
    }
  });

  if (scores.overall < 50) recs.unshift('<strong>우선 필수 속성부터 채우세요.</strong> 필수 속성 없이는 리치 결과가 전혀 표시되지 않습니다.');
  if (scores.bars[1].score < 60) recs.push('<strong>권장 속성을 추가하면 CTR이 20~30% 향상됩니다.</strong>');
  if (!types.includes('BreadcrumbList')) recs.push('<strong>BreadcrumbList 추가를 권장합니다.</strong> 거의 모든 페이지에 적용 가능합니다.');

  recs.push('<strong>Google Rich Results Test로 최종 검증하세요.</strong>');
  return [...new Set(recs)].slice(0, 5);
}

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
