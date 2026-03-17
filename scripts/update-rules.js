#!/usr/bin/env node
/**
 * GEO Rules Updater
 *
 * 이 스크립트는 GitHub Actions에서 매주 실행되어 rules.json을 갱신합니다.
 *
 * 갱신 방식:
 * 1. Google의 공개 스키마 정보를 참조하여 지원 타입/속성 검증
 * 2. schema.org 최신 버전과 비교
 * 3. AI 크롤러 목록: 하드코딩 + Dark Visitors 자동 수집 병합
 * 4. 버전 번호와 날짜 자동 갱신
 *
 * 수동 규칙 추가/수정은 rules.json을 직접 편집 후 커밋하면 됩니다.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const RULES_PATH = path.join(__dirname, '..', 'rules.json');

// ── Fetch helpers ──
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'GEO-Rules-Updater/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
function fetchJson(url) {
  return fetchText(url).then(text => {
    try { return JSON.parse(text); } catch { return null; }
  });
}

// ── ai-robots-txt 커뮤니티 목록에서 AI 크롤러 자동 수집 ──
// 소스: https://github.com/ai-robots-txt/ai.robots.txt (커뮤니티 유지, GitHub Actions 자동 갱신)
const REMOTE_BOTS_URL = 'https://raw.githubusercontent.com/ai-robots-txt/ai.robots.txt/main/robots.json';

// function 필드에서 importance 자동 분류
function classifyImportance(fn) {
  const f = (fn || '').toLowerCase();
  if (f.includes('search')) return 'high';
  if (f.includes('assistant')) return 'high';
  if (f.includes('agent')) return 'medium';
  return 'medium';
}

// operator 필드에서 org 추출 (마크다운 링크 제거)
function extractOrg(operator) {
  if (!operator || operator.includes('Unclear')) return '';
  return operator.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
}

async function fetchRemoteCrawlers() {
  try {
    const data = await fetchJson(REMOTE_BOTS_URL);
    if (!data || typeof data !== 'object') {
      console.log('🌐 ai-robots-txt: 데이터 형식 오류');
      return [];
    }

    const bots = Object.entries(data)
      .filter(([name, info]) => name && name.length > 0)
      .map(([name, info]) => ({
        name,
        org: extractOrg(info.operator),
        desc: (info.description || '').slice(0, 100),
        importance: classifyImportance(info.function),
        _source: 'ai-robots-txt'
      }));

    console.log(`🌐 ai-robots-txt: ${bots.length}개 AI 에이전트 발견`);
    return bots;
  } catch (e) {
    console.log(`🌐 ai-robots-txt 조회 실패 (폴백 사용): ${e.message}`);
  }
  return [];
}

// ── Known AI crawler bots (updated 2026-03) ──
// importance: high=주요 AI 검색엔진, medium=대형 플랫폼, low=기타
const AI_CRAWLERS = [
  { name: 'GPTBot', org: 'OpenAI', desc: 'ChatGPT/OpenAI 웹 크롤러', importance: 'high' },
  { name: 'ChatGPT-User', org: 'OpenAI', desc: 'ChatGPT 브라우징 모드', importance: 'high' },
  { name: 'OAI-SearchBot', org: 'OpenAI', desc: 'OpenAI 검색 크롤러', importance: 'high' },
  { name: 'ClaudeBot', org: 'Anthropic', desc: 'Claude AI 크롤러', importance: 'high' },
  { name: 'Google-Extended', org: 'Google', desc: 'Gemini/Bard 학습용', importance: 'high' },
  { name: 'GoogleOther', org: 'Google', desc: 'Google AI/연구용 크롤러', importance: 'medium' },
  { name: 'Googlebot', org: 'Google', desc: 'Google 검색 크롤러', importance: 'high' },
  { name: 'CCBot', org: 'Common Crawl', desc: 'Common Crawl 크롤러', importance: 'medium' },
  { name: 'PerplexityBot', org: 'Perplexity', desc: 'Perplexity AI 검색', importance: 'high' },
  { name: 'Amazonbot', org: 'Amazon', desc: 'Amazon Alexa AI', importance: 'medium' },
  { name: 'AI2Bot', org: 'Allen AI', desc: 'Allen Institute for AI', importance: 'low' },
  { name: 'Bytespider', org: 'ByteDance', desc: 'TikTok/ByteDance 크롤러', importance: 'medium' },
  { name: 'FacebookBot', org: 'Meta', desc: 'Meta AI 크롤러', importance: 'medium' },
  { name: 'Meta-ExternalAgent', org: 'Meta', desc: 'Meta AI 학습용 크롤러', importance: 'medium' },
  { name: 'Applebot-Extended', org: 'Apple', desc: 'Apple Intelligence 학습용', importance: 'high' },
  { name: 'Timpibot', org: 'Timpi', desc: '분산형 검색엔진 크롤러', importance: 'low' },
  { name: 'Diffbot', org: 'Diffbot', desc: 'AI 기반 웹 스크래핑', importance: 'low' },
  { name: 'ImagesiftBot', org: 'Hive', desc: 'Hive AI 이미지 분석', importance: 'low' },
  { name: 'cohere-ai', org: 'Cohere', desc: 'Cohere AI 크롤러', importance: 'low' },
  { name: 'YouBot', org: 'You.com', desc: 'You.com AI 검색 크롤러', importance: 'medium' },
  { name: 'Kagibot', org: 'Kagi', desc: 'Kagi 검색엔진 크롤러', importance: 'low' },
  { name: 'DeepSeekBot', org: 'DeepSeek', desc: 'DeepSeek AI 크롤러', importance: 'medium' },
  { name: 'VelenpublicBot', org: 'Velen', desc: 'Velen AI 검색 크롤러', importance: 'low' },
  { name: 'PetalBot', org: 'Huawei', desc: 'Huawei Petal 검색 크롤러', importance: 'low' },
];

// ── Google Rich Results supported types (latest) ──
const RICH_RESULT_TYPES = [
  'Product', 'Article', 'FAQPage', 'BreadcrumbList', 'Organization',
  'LocalBusiness', 'WebSite', 'Event', 'Recipe', 'VideoObject',
  'HowTo', 'Review', 'SoftwareApplication', 'Course', 'JobPosting',
  'Book', 'Movie', 'MusicGroup', 'Dataset', 'SpecialAnnouncement',
  'ClaimReview', 'EducationalOccupationalProgram', 'LearningResource',
  'MerchantListing', 'VacationRental', 'Vehicle', 'ProfilePage',
  'DiscussionForumPosting',
];

async function main() {
  console.log('📦 Loading current rules.json...');
  let rules;
  try {
    rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
  } catch (e) {
    console.error('❌ Failed to read rules.json:', e.message);
    process.exit(1);
  }

  const oldVersion = rules.version;
  let updated = false;

  // ── 1. Update AI crawler list (하드코딩 + 원격 자동 수집 병합) ──
  if (rules.geoRules?.aiCrawling?.bots) {
    // 원격 크롤러 목록 가져오기
    const remoteCrawlers = await fetchRemoteCrawlers();

    // 하드코딩 목록 + 원격 목록 병합 (하드코딩이 우선, 원격은 새 봇만 추가)
    const knownNames = new Set(AI_CRAWLERS.map(b => b.name));
    const mergedCrawlers = [
      ...AI_CRAWLERS,
      ...remoteCrawlers.filter(b => !knownNames.has(b.name)),
    ];

    const existingNames = new Set(rules.geoRules.aiCrawling.bots.map(b => b.name));
    const newBots = mergedCrawlers.filter(b => !existingNames.has(b.name));

    if (newBots.length > 0) {
      rules.geoRules.aiCrawling.bots.push(...newBots);
      const fromRemote = newBots.filter(b => b._source === 'darkvisitors');
      const fromLocal = newBots.filter(b => !b._source);
      if (fromLocal.length) console.log(`🤖 하드코딩 추가: ${fromLocal.map(b => b.name).join(', ')}`);
      if (fromRemote.length) console.log(`🌐 자동 감지 추가: ${fromRemote.map(b => b.name).join(', ')}`);
      updated = true;
    } else {
      console.log('🤖 AI crawler list is up to date');
    }

    // 기존 봇에 importance/label 필드 보충
    const crawlerMap = new Map(mergedCrawlers.map(b => [b.name, b]));
    for (const bot of rules.geoRules.aiCrawling.bots) {
      const ref = crawlerMap.get(bot.name);
      if (ref) {
        if (!bot.importance && ref.importance) { bot.importance = ref.importance; updated = true; }
        if (!bot.label && ref.org) { bot.label = `${bot.name} (${ref.org})`; updated = true; }
      }
    }
  }

  // ── 2. Check for new Rich Result types ──
  if (rules.schemaRules) {
    const existingTypes = new Set(Object.keys(rules.schemaRules));
    const newTypes = RICH_RESULT_TYPES.filter(t => !existingTypes.has(t));

    if (newTypes.length > 0) {
      console.log(`📋 New Rich Result types detected: ${newTypes.join(', ')}`);
      console.log('   → These need manual rule definitions. Creating stubs...');

      newTypes.forEach(type => {
        rules.schemaRules[type] = {
          label: type,
          required: ['name'],
          recommended: [],
          tips: [`${type} 타입의 세부 규칙은 아직 정의되지 않았습니다. 수동 업데이트가 필요합니다.`],
          _stub: true
        };
      });
      updated = true;
    } else {
      console.log('📋 Schema types are up to date');
    }
  }

  // ── 3. Validate existing rules integrity ──
  let integrityIssues = 0;
  if (rules.schemaRules) {
    for (const [type, r] of Object.entries(rules.schemaRules)) {
      if (!r.required || !Array.isArray(r.required)) {
        console.warn(`⚠️ ${type}: missing or invalid 'required' field`);
        integrityIssues++;
      }
      if (!r.tips || !Array.isArray(r.tips) || r.tips.length === 0) {
        console.warn(`⚠️ ${type}: missing tips`);
        integrityIssues++;
      }
    }
  }
  if (integrityIssues > 0) {
    console.log(`⚠️ Found ${integrityIssues} integrity issues`);
  } else {
    console.log('✅ Rules integrity check passed');
  }

  // ── 4. schema.org에서 하위 타입 → 상위 타입 폴백 매핑 자동 생성 ──
  try {
    const schemaInfo = await fetchJson('https://schema.org/version/latest/schemaorg-current-https.jsonld');
    if (schemaInfo && schemaInfo['@graph']) {
      const supportedTypes = new Set(Object.keys(rules.schemaRules));
      const typeFallback = {};

      // 1단계: 모든 타입의 직접 부모 관계 수집
      const parentMap = {}; // typeName → [parentName, ...]
      for (const node of schemaInfo['@graph']) {
        const id = node['@id'];
        if (!id || !id.startsWith('schema:')) continue;
        const typeName = id.replace('schema:', '');
        const parents = node['rdfs:subClassOf'];
        if (!parents) continue;
        const parentList = Array.isArray(parents) ? parents : [parents];
        parentMap[typeName] = parentList
          .map(p => (p?.['@id'] || p))
          .filter(p => typeof p === 'string' && p.startsWith('schema:'))
          .map(p => p.replace('schema:', ''));
      }

      // 2단계: 재귀적으로 가장 가까운 지원 상위 타입 찾기 (최대 5단계)
      function findSupportedParent(typeName, depth) {
        if (depth > 5 || !parentMap[typeName]) return null;
        for (const parent of parentMap[typeName]) {
          if (supportedTypes.has(parent)) return parent;
          const grandParent = findSupportedParent(parent, depth + 1);
          if (grandParent) return grandParent;
        }
        return null;
      }

      for (const typeName of Object.keys(parentMap)) {
        if (supportedTypes.has(typeName)) continue;
        const fallback = findSupportedParent(typeName, 0);
        if (fallback) typeFallback[typeName] = fallback;
      }

      // rules.json에 저장
      const oldCount = Object.keys(rules.typeFallback || {}).length;
      rules.typeFallback = typeFallback;
      const newCount = Object.keys(typeFallback).length;
      console.log(`📡 schema.org: ${newCount}개 하위 타입 폴백 매핑 생성`);
      if (newCount !== oldCount) updated = true;
    }
  } catch (e) {
    console.log(`📡 schema.org fetch 실패 (기존 매핑 유지): ${e.message}`);
  }

  // ── 5. Update version and date ──
  if (updated) {
    const parts = rules.version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // bump patch
    rules.version = parts.join('.');
    rules.lastUpdated = new Date().toISOString().split('T')[0];

    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + '\n', 'utf-8');
    console.log(`\n✅ Updated rules.json: ${oldVersion} → ${rules.version} (${rules.lastUpdated})`);
  } else {
    // Still update the check date
    rules.lastChecked = new Date().toISOString().split('T')[0];
    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + '\n', 'utf-8');
    console.log(`\n✅ No changes needed. Last checked: ${rules.lastChecked}`);
  }
}

main().catch(e => {
  console.error('❌ Update failed:', e);
  process.exit(1);
});
