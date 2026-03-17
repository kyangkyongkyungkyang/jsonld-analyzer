# CLAUDE.md (jsonld-analyzer)

## 프로젝트 개요
- **이름**: GEO Analyzer — Chrome Extension
- **목적**: JSON-LD 구조화 데이터 + GEO/SEO 분석
- **스택**: Vanilla JS, Manifest V3, GitHub Actions + Pages

## 프로젝트 구조
```
chrome-extension/     # 익스텐션 소스 (popup, analyzer, content script)
  _locales/           # i18n (ko, en)
  icons/              # 아이콘 PNG
scripts/              # CI/CD 스크립트
  update-rules.js     # 매주 월요일 GitHub Actions로 실행
rules.json            # 분석 규칙 데이터 (GitHub Pages 배포)
.github/workflows/    # GitHub Actions 워크플로우
```

## 데이터 갱신 체계
- **스키마 규칙**: `rules.json` → 매주 자동 검증
- **AI 크롤러**: `ai-robots-txt` 커뮤니티 목록에서 자동 수집
- **하위 타입 폴백**: `schema.org`에서 재귀 탐색으로 자동 생성 (263개)
- **분석 임계값**: `rules.json` > `analysisConfig`에서 원격 설정 가능
- **점수 가중치**: `rules.json` > `scoring.weights`에서 원격 설정 가능

## 코딩 컨벤션
- 빌드 도구 없음 — 바닐라 JS, 직접 브라우저에서 실행
- i18n: `msg('key', ...subs)` 함수 사용, `_locales/{lang}/messages.json` 관리
- 보안: 외부 데이터 → `escHtml()`, remote tips → `sanitizeHtml()`
- 원격 데이터: `rules.json` 우선, 실패 시 내장 `FALLBACK_*` 상수 사용
- CSS: 인라인 스타일 최소화, 동적 값(점수%, 색상)만 허용

## 주의사항
- `update-rules.js` 로컬 실행 시 `rules.json`이 덮어쓰기됨 — 정식 규칙 백업 확인 필요
- `rules.json`의 `scoring.weights`는 구버전(객체)과 신버전(숫자) 모두 호환 처리됨
- `FALLBACK_AI_BOTS`는 `update-rules.js`의 `AI_CRAWLERS` seed와 수동 동기화 필요
