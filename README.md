# GEO Analyzer — Chrome Extension

Google Rich Results + GEO(Generative Engine Optimization) 분석 Chrome 확장 프로그램

![license](https://img.shields.io/badge/license-MIT-00f0ff?style=flat-square)

## Features

- **28종 스키마 타입 지원** — Product, Article, FAQPage, BreadcrumbList, Organization, LocalBusiness, WebSite, Event, Recipe, VideoObject, HowTo, Review, SoftwareApplication, Course, JobPosting, Book, Movie, MusicGroup, Dataset, SpecialAnnouncement, ClaimReview, EducationalOccupationalProgram, LearningResource, MerchantListing, VacationRental, Vehicle, ProfilePage, DiscussionForumPosting
- **GEO 분석** — 메타태그, 헤딩 구조, E-E-A-T 신호, 콘텐츠 품질/AI 인용 용이성 평가
- **점수 대시보드** — JSON-LD, 메타태그, 헤딩, E-E-A-T, 콘텐츠 5개 항목 점수
- **AI 추천** — 타입별 Google 가이드라인 기반 맞춤 개선 팁
- **자동 규칙 갱신** — GitHub Pages에서 최신 rules.json을 24시간 캐시로 자동 로딩

## 설치 방법

1. Chrome에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `chrome-extension/` 폴더 선택

## 사용법

아무 웹 페이지에서 확장 아이콘 클릭 → JSON-LD 자동 추출 및 GEO/SEO 분석 결과 팝업 표시

## 규칙 갱신

- **자동**: GitHub Actions가 매주 월요일 `rules.json`을 갱신하여 GitHub Pages에 배포
- **수동**: 팝업 하단의 🔄 버튼으로 캐시 무시 후 최신 규칙 즉시 적용

## Tech Stack

- Manifest V3 Chrome Extension
- Vanilla JavaScript (빌드 도구 없음)
- GitHub Actions + GitHub Pages (규칙 자동 갱신)

## License

MIT
