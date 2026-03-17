# GEO Analyzer — Chrome Extension

Google Rich Results + GEO(Generative Engine Optimization) 분석 Chrome 확장 프로그램

![version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-00f0ff?style=flat-square) ![manifest](https://img.shields.io/badge/Manifest-V3-green?style=flat-square)

## Features

- **28종 스키마 타입 지원** — Product, Article, FAQPage, BreadcrumbList, Organization, LocalBusiness, WebSite, Event, Recipe, VideoObject, HowTo, Review, SoftwareApplication, Course, JobPosting + 13종 추가 (Book, Movie, Dataset 등)
- **263종 하위 타입 폴백** — BlogPosting→Article, Restaurant→LocalBusiness 등 schema.org 기반 자동 매핑
- **SEO · GEO 분석** — 메타태그, 헤딩 구조, E-E-A-T 신호, 콘텐츠 품질/AI 인용 용이성 평가
- **AI 크롤러 분석** — robots.txt 파싱으로 140+ AI 봇(GPTBot, ClaudeBot, PerplexityBot 등) 접근 허용 여부 확인
- **점수 대시보드** — JSON-LD, 메타태그, 헤딩, E-E-A-T, 콘텐츠 5개 항목 가중 점수
- **AI 추천** — 타입별 Google Rich Results 가이드라인 기반 맞춤 개선 팁
- **다국어** — 한국어/영어 자동 전환 (브라우저 언어 설정 기반)
- **자동 규칙 갱신** — GitHub Actions 매주 실행, GitHub Pages 배포, 24시간 캐시

## 설치 방법

1. Chrome에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `chrome-extension/` 폴더 선택

## 사용법

아무 웹 페이지에서 확장 아이콘 클릭 → 4개 탭으로 분석 결과 표시

| 탭 | 내용 |
|------|------|
| **종합** | 점수 대시보드 + AI 추천 + 주요 개선 사항 |
| **JSON-LD** | 구조화 데이터 필수/권장 속성 검증 |
| **SEO · GEO** | 메타태그, 헤딩, E-E-A-T, 콘텐츠 품질 |
| **AI 크롤러** | robots.txt 기반 AI 봇 접근 허용/차단 현황 |

## 자동 갱신 구조

```
GitHub Actions (매주 월요일)
  ├─ schema.org에서 263개 하위 타입 폴백 매핑 자동 생성
  ├─ ai-robots-txt 커뮤니티 목록에서 AI 크롤러 자동 수집
  ├─ 스키마 규칙 무결성 검증
  └─ rules.json 버전 bump → GitHub Pages 자동 배포
        ↓ (24시간 캐시)
  Chrome Extension → 최신 규칙 자동 적용
```

## 보안

- Manifest V3 CSP (`script-src 'self'; object-src 'none'`)
- HTML 이스케이프 (`escHtml`) + 태그 화이트리스트 (`sanitizeHtml`)
- content script sender 검증 (`sender.id === chrome.runtime.id`)
- 원격 규칙 fetch 타임아웃 (8초) + 스키마 검증
- `<all_urls>` 미사용 — `http://*/*`, `https://*/*`만 허용

## Tech Stack

- Manifest V3 Chrome Extension
- Vanilla JavaScript (빌드 도구 없음, 외부 의존성 없음)
- GitHub Actions + GitHub Pages (규칙 자동 갱신)
- [ai-robots-txt](https://github.com/ai-robots-txt/ai.robots.txt) (AI 크롤러 목록 소스)

## License

MIT
