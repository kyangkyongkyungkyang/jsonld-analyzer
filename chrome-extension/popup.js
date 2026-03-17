// ═══════════════════════════════════════════════
// Popup Controller v2 — GEO + JSON-LD Analysis
// ═══════════════════════════════════════════════
let extractedData = null;
let remoteRules = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Load remote rules in background
  loadRemoteRules().then(r => {
    remoteRules = r;
    if (r?.version) {
      document.getElementById('rulesVer').textContent = `rules v${r.version} · ${r.lastUpdated || ''}`;
    }
  });

  // Extract data from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    document.getElementById('pageUrl').textContent = tab.url;

    chrome.tabs.sendMessage(tab.id, { action: 'extractAll' }, response => {
      if (chrome.runtime.lastError || !response || response.error) {
        // Fallback: inject and execute
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }, () => {
          chrome.tabs.sendMessage(tab.id, { action: 'extractAll' }, resp2 => {
            if (chrome.runtime.lastError || !resp2 || resp2.error) {
              showEmptyState();
            } else {
              handleData(resp2);
            }
          });
        });
        return;
      }
      handleData(response);
    });
  });
});

function handleData(data) {
  extractedData = data;
  document.getElementById('stateLoading').classList.remove('active');

  const rules = remoteRules?.schemaRules || SCHEMA_RULES;
  const { issues: jsonldIssues, typeResults } = validateJsonLd(data.jsonlds || [], rules);
  const geoIssues = analyzeGeo(data);
  const scores = calculateOverallScores(jsonldIssues, geoIssues, data.jsonlds || []);
  const allIssues = [...jsonldIssues, ...geoIssues];

  // Show UI
  document.getElementById('summaryBar').style.display = 'flex';
  document.getElementById('tabBar').style.display = 'flex';
  document.getElementById('tab-overview').style.display = 'block';

  renderSummary(data, typeResults, scores);
  renderOverview(scores, allIssues, data);
  renderJsonldTab(jsonldIssues, typeResults, data.jsonlds || []);
  renderGeoTab(geoIssues);
  renderRawTab(data.jsonlds || []);
}

function showEmptyState() {
  document.getElementById('stateLoading').classList.remove('active');
  document.getElementById('stateEmpty').classList.add('active');
}

// ══════════════════════════
// RENDER: SUMMARY BAR
// ══════════════════════════
function renderSummary(data, typeResults, scores) {
  const count = (data.jsonlds || []).length;
  document.getElementById('summaryItemCount').textContent = count + (data.meta ? '+GEO' : '');
  document.getElementById('summaryTypesText').textContent = typeResults.map(t => t.type).join(', ') || 'GEO only';

  const scoreEl = document.getElementById('summaryScoreNum');
  scoreEl.textContent = scores.overall;
  scoreEl.style.color = getScoreColor(scores.overall);

  const grade = getGrade(scores.overall);
  const gradeEl = document.getElementById('summaryGrade');
  gradeEl.textContent = grade.g;
  gradeEl.style.background = `var(--${grade.cls}-bg)`;
  gradeEl.style.color = `var(--${grade.cls})`;

  // Tab badges
  const jErrors = data.jsonlds?.length > 0 ? 0 : 1; // placeholder
  updateTabBadge('badgeJsonld', (data.jsonlds || []).length, 'ok');

  const geoErrors = 0; // will be updated below
  updateTabBadge('badgeGeo', '—', 'ok');
}

function updateTabBadge(id, text, cls) {
  const el = document.getElementById(id);
  if (el) { el.textContent = text; el.className = `badge ${cls}`; }
}

// ══════════════════════════
// RENDER: OVERVIEW TAB
// ══════════════════════════
function renderOverview(scores, allIssues, data) {
  // Score ring
  const circ = 2 * Math.PI * 25;
  const offset = circ - (scores.overall / 100) * circ;
  const fill = document.getElementById('ringFill');
  const color = getScoreColor(scores.overall);
  fill.style.stroke = color;
  requestAnimationFrame(() => { fill.style.strokeDashoffset = offset; });

  const scoreEl = document.getElementById('ringScore');
  scoreEl.style.color = color;
  animateNum(scoreEl, scores.overall);

  const grade = getGrade(scores.overall);
  document.getElementById('overviewGrade').textContent = `${grade.g} · ${grade.t}`;
  document.getElementById('overviewGrade').style.color = `var(--${grade.cls})`;
  document.getElementById('overviewDesc').textContent =
    `JSON-LD ${(data.jsonlds||[]).length}개 · 메타 ${Object.values(data.meta||{}).filter(Boolean).length}개 · 이미지 ${data.content?.imageCount||0}개`;

  // Score bars
  document.getElementById('overviewBars').innerHTML = scores.bars.map(b => {
    const c = getScoreColor(b.score);
    return `<div class="sbar">
      <span class="sbar-label">${b.label}</span>
      <div class="sbar-track"><div class="sbar-fill" style="width:${b.score}%;background:${c}"></div></div>
      <span class="sbar-val" style="color:${c}">${b.score}</span>
    </div>`;
  }).join('');

  // AI Recommendations
  const recs = buildRecommendations(data.jsonlds || [], allIssues.filter(i => i.cat === 'jsonld'), allIssues.filter(i => i.cat !== 'jsonld'), scores);
  document.getElementById('aiBox').innerHTML = `
    <div class="ai-header">💡 AI 추천</div>
    ${recs.map(r => `<div class="ai-item">${r}</div>`).join('')}
  `;

  // Quick issues (errors + warns only, max 8)
  const quickIssues = allIssues.filter(i => i.sev === 'error' || i.sev === 'warn').slice(0, 8);
  if (quickIssues.length > 0) {
    document.getElementById('overviewIssues').innerHTML = `
      <div class="check-group">
        <div class="check-group-title">주요 개선 사항</div>
        ${quickIssues.map(i => checkItemHtml(i)).join('')}
      </div>`;
  }

  // Update tab badges
  const jsonldErrors = allIssues.filter(i => i.cat === 'jsonld' && i.sev === 'error').length;
  const jsonldWarns = allIssues.filter(i => i.cat === 'jsonld' && i.sev === 'warn').length;
  const geoErrors = allIssues.filter(i => i.cat !== 'jsonld' && i.sev === 'error').length;
  const geoWarns = allIssues.filter(i => i.cat !== 'jsonld' && i.sev === 'warn').length;

  updateTabBadge('badgeJsonld', jsonldErrors + jsonldWarns || '✓',
    jsonldErrors > 0 ? 'error' : jsonldWarns > 0 ? 'warn' : 'ok');
  updateTabBadge('badgeGeo', geoErrors + geoWarns || '✓',
    geoErrors > 0 ? 'error' : geoWarns > 0 ? 'warn' : 'ok');
}

// ══════════════════════════
// RENDER: JSON-LD TAB
// ══════════════════════════
function renderJsonldTab(issues, typeResults, jsonlds) {
  const container = document.getElementById('jsonldChecks');

  if (jsonlds.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem;color:var(--text3)">
        <div style="font-size:1.5rem;margin-bottom:.5rem">📭</div>
        <p style="font-size:.8rem">JSON-LD 구조화 데이터가 없습니다</p>
      </div>`;
    return;
  }

  // Group by type
  const typeHtml = typeResults.map(t =>
    `<span style="display:inline-block;padding:.2rem .5rem;border-radius:10px;font-size:.68rem;font-weight:500;
      background:${t.supported ? 'var(--primary-bg)' : 'var(--bg-card)'};
      color:${t.supported ? 'var(--primary)' : 'var(--text3)'};
      border:1px solid ${t.supported ? 'var(--primary-light)' : 'var(--border)'};
      margin:0 .2rem .3rem 0">${t.type} · ${t.label}</span>`
  ).join('');

  const errors = issues.filter(i => i.sev === 'error');
  const warns = issues.filter(i => i.sev === 'warn');
  const passes = issues.filter(i => i.sev === 'pass');

  container.innerHTML = `
    <div style="margin-bottom:.75rem">${typeHtml}</div>
    ${errors.length > 0 ? buildCheckGroup('오류', errors) : ''}
    ${warns.length > 0 ? buildCheckGroup('경고', warns) : ''}
    ${passes.length > 0 ? buildCheckGroup('통과', passes) : ''}
  `;
}

// ══════════════════════════
// RENDER: GEO TAB
// ══════════════════════════
function renderGeoTab(issues) {
  const container = document.getElementById('geoChecks');
  const cats = [
    { key: 'meta', title: '메타태그' },
    { key: 'headings', title: '헤딩 구조' },
    { key: 'eeat', title: 'E-E-A-T 신호' },
    { key: 'content', title: '콘텐츠 / 인용 가능성' },
  ];

  container.innerHTML = cats.map(cat => {
    const items = issues.filter(i => i.cat === cat.key);
    if (items.length === 0) return '';
    return buildCheckGroup(cat.title, items);
  }).join('');
}

// ══════════════════════════
// RENDER: RAW TAB
// ══════════════════════════
function renderRawTab(jsonlds) {
  if (jsonlds.length === 0) {
    document.getElementById('jsonView').textContent = '// JSON-LD 데이터 없음';
    return;
  }
  document.getElementById('jsonView').innerHTML =
    jsonlds.map(ld => syntaxHighlight(JSON.stringify(ld, null, 2))).join('\n\n');
}

// ══════════════════════════
// UI HELPERS
// ══════════════════════════
function checkItemHtml(issue) {
  const icons = { pass: '✓', error: '✕', warn: '!', info: 'i' };
  return `<div class="check-item">
    <div class="check-icon ${issue.sev}">${icons[issue.sev] || 'i'}</div>
    <div class="check-body">
      <div class="check-title">${issue.text}</div>
      ${issue.desc ? `<div class="check-desc">${issue.desc}</div>` : ''}
    </div>
  </div>`;
}

function buildCheckGroup(title, items) {
  return `<div class="check-group">
    <div class="check-group-title">${title}</div>
    ${items.map(i => checkItemHtml(i)).join('')}
  </div>`;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${name}`));
}

function toggleSection(header) {
  header.classList.toggle('open');
  header.nextElementSibling.classList.toggle('open');
}

function animateNum(el, target) {
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 25));
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(iv);
  }, 25);
}

function copyJsonLd() {
  if (!extractedData?.jsonlds?.length) return;
  navigator.clipboard.writeText(JSON.stringify(extractedData.jsonlds, null, 2)).then(() => {
    const btn = document.getElementById('btnCopy');
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 1200);
  });
}

function openFullAnalyzer() {
  chrome.tabs.create({ url: 'https://kyangkyongkyungkyang.github.io/jsonld-analyzer/' });
}
