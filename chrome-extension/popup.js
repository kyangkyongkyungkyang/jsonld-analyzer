// Popup controller — communicates with content script and renders results
let extractedJsonLds = [];

document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    document.getElementById('pageUrl').textContent = tab.url;

    chrome.tabs.sendMessage(tab.id, { action: 'extractJsonLd' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script might not be injected yet — try scripting API
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            const results = [];
            scripts.forEach(s => {
              try {
                const p = JSON.parse(s.textContent.trim());
                if (Array.isArray(p)) results.push(...p);
                else if (p['@graph']) results.push(...p['@graph']);
                else results.push(p);
              } catch {}
            });
            return { jsonlds: results, url: window.location.href, title: document.title };
          }
        }, (injectionResults) => {
          if (chrome.runtime.lastError || !injectionResults?.[0]?.result) {
            showEmpty();
            return;
          }
          handleResponse(injectionResults[0].result);
        });
        return;
      }
      handleResponse(response);
    });
  });
});

function handleResponse(data) {
  document.getElementById('stateLoading').classList.remove('active');

  if (!data.jsonlds || data.jsonlds.length === 0) {
    showEmpty();
    return;
  }

  extractedJsonLds = data.jsonlds;
  runPopupAnalysis(data.jsonlds);
}

function showEmpty() {
  document.getElementById('stateLoading').classList.remove('active');
  document.getElementById('stateEmpty').classList.add('active');
}

function runPopupAnalysis(jsonlds) {
  document.getElementById('results').style.display = 'block';

  const allIssues = [];
  const types = [];

  jsonlds.forEach((ld, idx) => {
    const type = getType(ld);
    const rules = SCHEMA_RULES[type];
    types.push({ type, label: rules?.label || type, supported: !!rules });
    if (rules) {
      allIssues.push(...validateSchema(ld, type, rules, idx));
    } else {
      allIssues.push({ sev: 'info', text: `"${type}" — 전용 검증 규칙 없음` });
    }
  });

  const scores = calculateScores(allIssues, jsonlds);
  renderPopup(scores, types, allIssues, jsonlds);
}

function renderPopup(scores, types, issues, jsonlds) {
  // Score
  const color = getScoreColor(scores.overall);
  const grade = getGrade(scores.overall);
  const scoreNum = document.getElementById('scoreNum');
  scoreNum.style.color = color;
  animateNum(scoreNum, scores.overall);

  const gradeEl = document.getElementById('scoreGrade');
  gradeEl.textContent = `${grade.g} · ${grade.t}`;
  gradeEl.style.color = color;
  gradeEl.style.background = color === 'var(--green)' ? 'rgba(0,255,136,.12)' :
    color === 'var(--amber)' ? 'rgba(255,184,0,.12)' : 'rgba(255,61,90,.12)';

  // Bars
  document.getElementById('scoreBars').innerHTML = scores.bars.map(b => `
    <div class="bar-item">
      <span class="bar-label">${b.label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${b.score}%;background:${b.color}"></div></div>
      <span class="bar-val" style="color:${b.color}">${b.score}</span>
    </div>
  `).join('');

  // Types
  document.getElementById('typesList').innerHTML = types.map(t =>
    `<span class="type-tag${t.supported ? '' : ' unknown'}">${t.type}${t.label !== t.type ? ` · ${t.label}` : ''}</span>`
  ).join('');

  // AI
  const recs = buildRecommendations(jsonlds, issues, scores);
  document.getElementById('aiBox').innerHTML = `
    <div class="ai-title">🤖 AI 추천</div>
    ${recs.map(r => `<div class="ai-item">${r}</div>`).join('')}
  `;

  // Issues by category
  const errorIssues = issues.filter(i => i.sev === 'error');
  const warnIssues = issues.filter(i => i.sev === 'warn');
  const passIssues = issues.filter(i => i.sev === 'pass');

  let html = '';
  if (errorIssues.length > 0) {
    html += buildSection('🔴 오류', errorIssues, 'error', errorIssues.length);
  }
  if (warnIssues.length > 0) {
    html += buildSection('🟡 경고', warnIssues, 'warn', warnIssues.length);
  }
  if (passIssues.length > 0) {
    html += buildSection('✅ 통과', passIssues, 'pass', passIssues.length);
  }
  document.getElementById('issuesList').innerHTML = html;

  // JSON view
  document.getElementById('jsonCount').textContent = `${jsonlds.length}개`;
  document.getElementById('jsonView').innerHTML = jsonlds.map(ld =>
    syntaxHighlight(JSON.stringify(ld, null, 2))
  ).join('\n\n');
}

function buildSection(title, issues, sev, count) {
  const countColor = sev === 'error' ? 'var(--red)' : sev === 'warn' ? 'var(--amber)' : 'var(--green)';
  return `<div class="section">
    <div class="section-header" onclick="toggleSection(this)">
      <span>${title} <span class="count" style="background:${countColor}22;color:${countColor}">${count}</span></span>
      <span class="chevron">▼</span>
    </div>
    <div class="section-body">
      ${issues.map(i => `
        <div class="issue">
          <div class="dot ${i.sev}"></div>
          <div class="issue-text">${i.text}${i.desc ? `<br><span style="font-size:.65rem;color:var(--text3)">${i.desc}</span>` : ''}</div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function toggleSection(header) {
  header.classList.toggle('open');
  header.nextElementSibling.classList.toggle('open');
}

function animateNum(el, target) {
  let cur = 0;
  const step = Math.ceil(target / 30);
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(iv);
  }, 25);
}

function copyJsonLd() {
  const text = JSON.stringify(extractedJsonLds, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btnCopy');
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => btn.textContent = '📋 JSON-LD 복사', 1500);
  });
}

function openFullAnalyzer() {
  chrome.tabs.create({ url: 'https://kyangkyongkyungkyang.github.io/jsonld-analyzer/' });
}
