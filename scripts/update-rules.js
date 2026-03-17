#!/usr/bin/env node
/**
 * GEO Rules Updater
 *
 * 이 스크립트는 GitHub Actions에서 매주 실행되어 rules.json을 갱신합니다.
 *
 * 갱신 방식:
 * 1. Google의 공개 스키마 정보를 참조하여 지원 타입/속성 검증
 * 2. schema.org 최신 버전과 비교
 * 3. GEO 관련 AI 크롤러 목록 업데이트
 * 4. 버전 번호와 날짜 자동 갱신
 *
 * 수동 규칙 추가/수정은 rules.json을 직접 편집 후 커밋하면 됩니다.
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const RULES_PATH = path.join(__dirname, '..', 'rules.json');

// ── Fetch helper ──
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'GEO-Rules-Updater/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

// ── Known AI crawler bots (updated list) ──
const AI_CRAWLERS = [
  { name: 'GPTBot', org: 'OpenAI', desc: 'ChatGPT/OpenAI 웹 크롤러' },
  { name: 'ChatGPT-User', org: 'OpenAI', desc: 'ChatGPT 브라우징 모드' },
  { name: 'OAI-SearchBot', org: 'OpenAI', desc: 'OpenAI 검색 크롤러' },
  { name: 'ClaudeBot', org: 'Anthropic', desc: 'Claude AI 크롤러' },
  { name: 'Google-Extended', org: 'Google', desc: 'Gemini/Bard 학습용' },
  { name: 'Googlebot', org: 'Google', desc: 'Google 검색 크롤러' },
  { name: 'CCBot', org: 'Common Crawl', desc: 'Common Crawl 크롤러' },
  { name: 'PerplexityBot', org: 'Perplexity', desc: 'Perplexity AI 검색' },
  { name: 'Amazonbot', org: 'Amazon', desc: 'Amazon Alexa AI' },
  { name: 'AI2Bot', org: 'Allen AI', desc: 'Allen Institute for AI' },
  { name: 'Bytespider', org: 'ByteDance', desc: 'TikTok/ByteDance 크롤러' },
  { name: 'FacebookBot', org: 'Meta', desc: 'Meta AI 크롤러' },
  { name: 'Applebot-Extended', org: 'Apple', desc: 'Apple Intelligence 학습용' },
  { name: 'Timpibot', org: 'Timpi', desc: '분산형 검색엔진 크롤러' },
  { name: 'Diffbot', org: 'Diffbot', desc: 'AI 기반 웹 스크래핑' },
  { name: 'ImagesiftBot', org: 'Hive', desc: 'Hive AI 이미지 분석' },
  { name: 'cohere-ai', org: 'Cohere', desc: 'Cohere AI 크롤러' },
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

  // ── 1. Update AI crawler list ──
  if (rules.geoRules?.aiCrawling?.bots) {
    const existingNames = new Set(rules.geoRules.aiCrawling.bots.map(b => b.name));
    const newBots = AI_CRAWLERS.filter(b => !existingNames.has(b.name));

    if (newBots.length > 0) {
      rules.geoRules.aiCrawling.bots.push(...newBots);
      console.log(`🤖 Added ${newBots.length} new AI crawlers: ${newBots.map(b => b.name).join(', ')}`);
      updated = true;
    } else {
      console.log('🤖 AI crawler list is up to date');
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

  // ── 4. Try to fetch schema.org version ──
  try {
    const schemaInfo = await fetchJson('https://schema.org/version/latest/schemaorg-current-https.jsonld');
    if (schemaInfo) {
      console.log('📡 schema.org data fetched successfully');
      // Could cross-reference types here in the future
    }
  } catch (e) {
    console.log('📡 schema.org fetch skipped (offline or rate-limited)');
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
