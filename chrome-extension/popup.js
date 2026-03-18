// ═══════════════════════════════════════════════
// Popup Controller v2 — GEO + JSON-LD Analysis
// ═══════════════════════════════════════════════
let extractedData = null;
let remoteRules = null;
let activeTabId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // ── i18n: HTML 정적 텍스트 로케일 적용 ──
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = msg(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = msg(el.dataset.i18nTitle);
  });

  // ── Event listeners (Manifest V3 CSP requires no inline handlers) ──
  document.getElementById('btnCopy').addEventListener('click', copyJsonLd);
  document.querySelectorAll('.tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // 규칙 새로고침 버튼 (캐시 무시)
  const refreshBtn = document.getElementById('btnRefreshRules');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.textContent = '⏳';
      refreshBtn.disabled = true;
      const r = await loadRemoteRules(true);
      remoteRules = r;
      updateRulesVersionUI(r);
      refreshBtn.textContent = '🔄';
      refreshBtn.disabled = false;
      if (extractedData) handleData(extractedData);
    });
  }

  // remote rules 로딩 + 페이지 데이터 추출을 병렬로 실행하되, 둘 다 완료 후 분석 시작
  const rulesPromise = loadRemoteRules().then(r => {
    remoteRules = r;
    updateRulesVersionUI(r);
  });

  const dataPromise = new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      activeTabId = tab.id;
      document.getElementById('pageUrl').textContent = tab.url;

      // chrome://, edge://, about: 등 브라우저 내부 페이지는 스크립트 주입 불가
      if (!tab.url || !tab.url.match(/^https?:\/\//)) {
        resolve(null);
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: 'extractAll' }, response => {
        if (chrome.runtime.lastError || !response || response.error) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }, () => {
            if (chrome.runtime.lastError) { resolve(null); return; }
            chrome.tabs.sendMessage(tab.id, { action: 'extractAll' }, resp2 => {
              resolve((!chrome.runtime.lastError && resp2 && !resp2.error) ? resp2 : null);
            });
          });
          return;
        }
        resolve(response);
      });
    });
  });

  // 둘 다 완료되면 분석 시작
  const [, pageData] = await Promise.all([rulesPromise, dataPromise]);
  if (pageData) {
    handleData(pageData);
  } else {
    showEmptyState();
  }
});

function handleData(data) {
  extractedData = data;
  document.getElementById('stateLoading').classList.remove('active');

  const rules = remoteRules?.schemaRules || SCHEMA_RULES;
  const { issues: jsonldIssues, typeResults } = validateJsonLd(data.jsonlds || [], rules, remoteRules);
  const geoIssues = analyzeGeo(data, remoteRules);
  const scores = calculateOverallScores(jsonldIssues, geoIssues, data.jsonlds || [], remoteRules);
  const allIssues = [...jsonldIssues, ...geoIssues];

  // Show UI (toggle CSS classes instead of inline styles)
  document.getElementById('tabBar').classList.remove('hidden');
  document.getElementById('tab-overview').classList.add('active');

  renderOverview(scores, allIssues, data, rules);
  renderJsonldTab(jsonldIssues, typeResults, data.jsonlds || [], rules);
  renderGeoTab(geoIssues);
  loadCrawlerData();
}

function showEmptyState() {
  document.getElementById('stateLoading').classList.remove('active');
  document.getElementById('stateEmpty').classList.add('active');
}

function updateTabBadge(id, text, cls) {
  const el = document.getElementById(id);
  if (el) { el.textContent = text; el.className = `badge ${cls}`; }
}

// ══════════════════════════
// RENDER: OVERVIEW TAB
// ══════════════════════════
function renderOverview(scores, allIssues, data, rules) {
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
    msg('overviewDesc', (data.jsonlds||[]).length, Object.values(data.meta||{}).filter(Boolean).length, data.content?.imageCount||0);

  // Score bars
  document.getElementById('overviewBars').innerHTML = scores.bars.map(b => {
    const c = getScoreColor(b.score);
    return `<div class="sbar">
      <span class="sbar-label">${b.label}</span>
      <div class="sbar-track"><div class="sbar-fill" style="width:${b.score}%;background:${c}"></div></div>
      <span class="sbar-val" style="color:${c}">${b.score}</span>
    </div>`;
  }).join('');

  // AI Recommendations (remote rules의 tips 우선 사용)
  const recs = buildRecommendations(data.jsonlds || [], allIssues.filter(i => i.cat === 'jsonld'), allIssues.filter(i => i.cat !== 'jsonld'), scores, rules);
  document.getElementById('aiBox').innerHTML = `
    <div class="ai-header">${msg('aiHeader')}</div>
    ${recs.map(r => `<div class="ai-item">${r}</div>`).join('')}
  `;

  // Quick issues (errors + warns only, max 8)
  const quickIssues = allIssues.filter(i => i.sev === 'error' || i.sev === 'warn').slice(0, 8);
  if (quickIssues.length > 0) {
    document.getElementById('overviewIssues').innerHTML = `
      <div class="check-group">
        <div class="check-group-title">${msg('issuesHeader')}</div>
        ${quickIssues.map(i => checkItemHtml(i, (data.jsonlds || []).length > 1)).join('')}
      </div>`;
  }

  // Update tab badges
  const jsonldErrors = allIssues.filter(i => i.cat === 'jsonld' && i.sev === 'error').length;
  const jsonldWarns = allIssues.filter(i => i.cat === 'jsonld' && i.sev === 'warn').length;
  const geoErrors = allIssues.filter(i => i.cat !== 'jsonld' && i.sev === 'error').length;
  const geoWarns = allIssues.filter(i => i.cat !== 'jsonld' && i.sev === 'warn').length;

  // JSON-LD 없으면 ✕, 있으면 에러/경고 수 또는 ✓
  const hasJsonld = (data.jsonlds || []).length > 0;
  if (!hasJsonld) {
    updateTabBadge('badgeJsonld', '✕', 'error');
  } else {
    updateTabBadge('badgeJsonld', jsonldErrors + jsonldWarns || '✓',
      jsonldErrors > 0 ? 'error' : jsonldWarns > 0 ? 'warn' : 'ok');
  }
  updateTabBadge('badgeGeo', geoErrors + geoWarns || '✓',
    geoErrors > 0 ? 'error' : geoWarns > 0 ? 'warn' : 'ok');
}

// ══════════════════════════
// RENDER: JSON-LD TAB
// ══════════════════════════
function renderJsonldTab(issues, typeResults, jsonlds, rules) {
  const container = document.getElementById('jsonldChecks');

  if (jsonlds.length === 0) {
    container.innerHTML = `
      <div class="jsonld-empty">
        <div class="jsonld-empty-icon">📭</div>
        <p class="jsonld-empty-text">${msg('noJsonld')}</p>
      </div>`;
    return;
  }

  const typeHtml = typeResults.map(t =>
    `<span class="type-badge ${t.supported ? 'supported' : 'unsupported'}">${t.type} · ${t.label}</span>`
  ).join('');

  const errors = issues.filter(i => i.sev === 'error');
  const warns = issues.filter(i => i.sev === 'warn');
  const passes = issues.filter(i => i.sev === 'pass');
  // 2개 이상이거나 폴백 분석된 타입이 있으면 타입 태그 표시
  const showTypes = jsonlds.length > 1 || typeResults.some(t => t.isFallback);

  // 타입별 tips — 한국어 tips는 한국어 로케일에서만
  const uniqueTips = [];
  if (isKoLocale()) {
    const rulesLookup = rules || SCHEMA_RULES;
    const fallback = getTypeFallback(remoteRules);
    const tips = [];
    jsonlds.map(getType).forEach(type => {
      const r = rulesLookup[type] || rulesLookup[fallback?.[type]];
      if (r?.tips) tips.push(...r.tips.slice(0, 2));
    });
    uniqueTips.push(...[...new Set(tips)].slice(0, 4));
  }

  // 에러/경고 없으면 축하 메시지
  const allGoodHtml = (errors.length === 0 && warns.length === 0 && passes.length > 0)
    ? `<div class="check-item check-item--hero">
        <div class="check-icon pass check-icon--lg">✓</div>
        <div class="check-body">
          <div class="check-title">${msg('jsonldAllGood')}</div>
          <div class="check-desc">${msg('jsonldAllGoodDesc')}</div>
        </div>
      </div>` : '';

  container.innerHTML = `
    <div class="type-badges">${typeHtml}</div>
    ${allGoodHtml}
    ${errors.length > 0 ? buildCheckGroup(msg('groupError'), errors, showTypes) : ''}
    ${warns.length > 0 ? buildCheckGroup(msg('groupWarn'), warns, showTypes) : ''}
    ${(errors.length > 0 || warns.length > 0) && passes.length > 0 ? buildCheckGroup(msg('groupPass'), passes, showTypes) : ''}
    ${uniqueTips.length > 0 ? `<div class="section-tip">${uniqueTips.map(t => sanitizeHtml(t)).join('<br><br>')}</div>` : ''}
  `;
}

// ══════════════════════════
// RENDER: GEO TAB
// ══════════════════════════
function renderGeoTab(issues) {
  const container = document.getElementById('geoChecks');
  const cats = [
    { key: 'meta', title: msg('catMeta') },
    { key: 'headings', title: msg('catHeadings') },
    { key: 'eeat', title: msg('catEeat') },
    { key: 'content', title: msg('catContent') },
  ];

  container.innerHTML = cats.map(cat => {
    const items = issues.filter(i => i.cat === cat.key);
    if (items.length === 0) return '';
    return buildCheckGroup(cat.title, items);
  }).join('');
}

// UI HELPERS
// ══════════════════════════
function checkItemHtml(issue, showTypeLabel) {
  const icons = { pass: '✓', error: '✕', warn: '!', info: 'i' };
  const typeBadge = (showTypeLabel && issue.typeLabel) ? `<span class="check-type">${issue.typeLabel}</span>` : '';
  return `<div class="check-item">
    <div class="check-icon ${issue.sev}">${icons[issue.sev] || 'i'}</div>
    <div class="check-body">
      <div class="check-title">${typeBadge}${issue.text}</div>
      ${issue.desc ? `<div class="check-desc">${issue.desc}</div>` : ''}
    </div>
  </div>`;
}

function buildCheckGroup(title, items, showTypeLabel) {
  return `<div class="check-group">
    <div class="check-group-title">${title}</div>
    ${items.map(i => checkItemHtml(i, showTypeLabel)).join('')}
  </div>`;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${name}`));
}

function animateNum(el, target) {
  if (el._animIv) clearInterval(el._animIv);
  const t = isNaN(target) ? 0 : Math.max(0, Math.round(target));
  if (t === 0) { el.textContent = '0'; return; }
  let cur = 0;
  const step = Math.max(1, Math.ceil(t / 25));
  el._animIv = setInterval(() => {
    cur = Math.min(cur + step, t);
    el.textContent = cur;
    if (cur >= t) { clearInterval(el._animIv); el._animIv = null; }
  }, 25);
}

function updateRulesVersionUI(r) {
  const el = document.getElementById('rulesVer');
  if (!el) return;
  if (r?.version) {
    el.textContent = `rules v${r.version} · ${r.lastUpdated || ''}`;
    el.style.color = '';
  } else {
    el.textContent = msg('offlineRules');
    el.style.color = 'var(--amber, #f59e0b)';
  }
}

// ══════════════════════════
// AI CRAWLERS TAB
// ══════════════════════════
function loadCrawlerData() {
  if (!activeTabId) return;
  chrome.tabs.sendMessage(activeTabId, { action: 'fetchRobotsTxt' }, response => {
    if (chrome.runtime.lastError || !response) {
      renderCrawlerTab(null);
      return;
    }
    renderCrawlerTab(response.robotsTxt);
  });
}

function renderCrawlerTab(robotsTxt) {
  const container = document.getElementById('crawlerChecks');
  const result = analyzeCrawlerAccess(robotsTxt, remoteRules);

  if (!result.available) {
    container.innerHTML = `
      <div class="check-group empty-center">
        <div class="check-icon warn check-icon--lg" style="margin:0 auto .5rem">!</div>
        <div class="empty-center-title">${msg('crawlerNoRobots')}</div>
        <div class="empty-center-desc">${msg('crawlerNoRobotsDesc')}</div>
      </div>`;
    updateTabBadge('badgeCrawlers', '?', 'warn');
    return;
  }

  const allowed = result.bots.filter(b => b.status === 'allowed');
  const blocked = result.bots.filter(b => b.status === 'blocked');
  const noRule = result.bots.filter(b => b.status === 'no_rule');

  // Badge
  if (blocked.length > 0) {
    updateTabBadge('badgeCrawlers', blocked.length, 'error');
  } else {
    updateTabBadge('badgeCrawlers', '✓', 'ok');
  }

  const statusText = { allowed: msg('crawlerAllowed'), blocked: msg('crawlerBlocked'), no_rule: msg('crawlerNoRule') };

  function botItemHtml(bot) {
    const impLabel = bot.importance === 'high' ? '★' : '';
    return `<div class="crawler-item">
      <div class="crawler-dot ${bot.status}"></div>
      <div class="crawler-name">${escHtml(bot.label)}${impLabel ? `<span class="imp">${impLabel}</span>` : ''}</div>
      <div class="crawler-status ${bot.status}">${statusText[bot.status]}</div>
    </div>`;
  }

  let html = `<div class="crawler-summary">${msg('crawlerSummary', allowed.length + noRule.length, blocked.length, noRule.length)}</div>`;

  if (result.wildcardBlocked) {
    html += `<div class="check-item"><div class="check-icon error">✕</div><div class="check-body">
      <div class="check-title">${msg('crawlerWildcardBlock')}</div></div></div>`;
  }

  if (blocked.length > 0) {
    html += `<div class="check-group"><div class="check-group-title">${msg('crawlerGroupBlocked')}</div>${blocked.map(botItemHtml).join('')}</div>`;
  }
  if (allowed.length > 0) {
    html += `<div class="check-group"><div class="check-group-title">${msg('crawlerGroupAllowed')}</div>${allowed.map(botItemHtml).join('')}</div>`;
  }
  if (noRule.length > 0) {
    html += `<div class="check-group"><div class="check-group-title">${msg('crawlerGroupNoRule')}</div>${noRule.map(botItemHtml).join('')}</div>`;
  }

  html += `<div class="crawler-tip">${msg('crawlerTip')}</div>`;
  container.innerHTML = html;
}

function copyJsonLd() {
  if (!extractedData?.jsonlds?.length) return;
  navigator.clipboard.writeText(JSON.stringify(extractedData.jsonlds, null, 2)).then(() => {
    const btn = document.getElementById('btnCopy');
    btn.textContent = '✅';
    setTimeout(() => btn.textContent = '📋', 1200);
  });
}
