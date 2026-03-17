# JSON-LD Structured Data Analyzer

Google Rich Results 가이드라인 기반 JSON-LD 구조화 데이터 분석 도구

**[Live Demo](https://kyangkyongkyungkyang.github.io/jsonld-analyzer/)**

![screenshot](https://img.shields.io/badge/status-live-00ff88?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-00f0ff?style=flat-square)

## Features

- **URL 입력** — 웹 페이지 주소를 입력하면 JSON-LD를 자동 추출하여 분석
- **직접 붙여넣기** — HTML 소스 또는 JSON-LD를 직접 붙여넣어 분석
- **15종 스키마 타입 지원** — Product, Article, FAQPage, BreadcrumbList, Organization, LocalBusiness, WebSite, Event, Recipe, VideoObject, HowTo, Review, SoftwareApplication, Course, JobPosting
- **점수 대시보드** — 필수 속성, 권장 속성, 커버리지, 데이터 품질 4개 항목 점수
- **AI 추천** — 타입별 Google 가이드라인 기반 맞춤 개선 팁
- **샘플 데이터** — 주요 스키마 타입별 샘플로 바로 테스트

## How It Works

1. URL 입력 시 [allorigins](https://allorigins.win/) CORS 프록시를 통해 페이지를 가져옵니다
2. `<script type="application/ld+json">` 태그에서 JSON-LD를 추출합니다
3. Google Rich Results 가이드라인의 필수/권장 속성 규칙과 비교합니다
4. 점수, 오류/경고, AI 추천을 대시보드로 표시합니다

## Tech Stack

- **단일 HTML 파일** — 빌드 없이 브라우저에서 바로 실행
- **백엔드 불필요** — CORS 프록시(allorigins.win)로 외부 URL 접근
- **Google Fonts** — JetBrains Mono + Noto Sans KR

## License

MIT
