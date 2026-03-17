// Google Rich Results Schema Rules (2026)
const SCHEMA_RULES = {
  Product: {
    label: '상품', required: ['name'],
    recommended: ['image','description','sku','brand','offers','aggregateRating','review'],
    offers_required: ['price','priceCurrency','availability'],
    offers_recommended: ['url','priceValidUntil','itemCondition','seller'],
    tips: [
      '`offers`에 `availability` 속성은 Google 쇼핑 탭 노출의 핵심 조건입니다.',
      '`aggregateRating` + `review`가 함께 있으면 별점 리치 결과 노출 확률이 높아집니다.',
      '`image`는 최소 1개, 권장 3개 이상(다각도) 제공하세요.',
      '`brand.name`이 있으면 Google 머천트 센터 매칭 정확도가 올라갑니다.',
      '`gtin`, `mpn` 등 글로벌 식별자를 추가하면 제품 검색 정확도가 크게 향상됩니다.'
    ]
  },
  Article: {
    label: '기사/블로그', required: ['headline','author','datePublished'],
    recommended: ['image','dateModified','publisher','description','mainEntityOfPage','articleBody'],
    author_required: ['name'], author_recommended: ['url'],
    publisher_required: ['name','logo'],
    tips: [
      '`dateModified`는 콘텐츠 신선도 시그널로, 구글이 크롤링 우선순위에 반영합니다.',
      '`author.url`을 프로필 페이지로 연결하면 E-E-A-T 신호가 강화됩니다.',
      '`image`는 1200px 이상 너비를 권장하며, 최소 696px 이상이어야 합니다.',
      '`publisher.logo`는 60x600px 이내, 흰색/밝은 배경 권장입니다.'
    ]
  },
  FAQPage: {
    label: 'FAQ', required: ['mainEntity'],
    mainEntity_required: ['name','acceptedAnswer'], acceptedAnswer_required: ['text'],
    recommended: [],
    tips: [
      '각 질문(`name`)은 완전한 문장 형태의 질문이어야 합니다.',
      '답변(`acceptedAnswer.text`)에 HTML 마크업 사용 시 `<a>`, `<b>`, `<br>` 등만 허용됩니다.',
      'FAQ 리치 결과는 페이지당 최대 2개 질문만 SERP에 노출됩니다.',
      '2023년 이후 자동 생성 FAQ에 대한 리치 결과 노출이 제한되었습니다.'
    ]
  },
  BreadcrumbList: {
    label: '탐색경로', required: ['itemListElement'],
    itemListElement_required: ['position','name','item'], recommended: [],
    tips: [
      '`position`은 1부터 시작하는 연속 정수여야 합니다.',
      '마지막 항목(현재 페이지)은 `item`(URL) 생략이 가능합니다.',
      '모든 `item` URL은 절대 경로여야 합니다.'
    ]
  },
  Organization: {
    label: '조직', required: ['name','url'],
    recommended: ['logo','sameAs','contactPoint','address','description','foundingDate'],
    tips: [
      '`sameAs`에 공식 SNS 프로필을 등록하면 지식 패널 노출에 유리합니다.',
      '`logo`는 112x112px 이상의 정사각형 또는 직사각형을 권장합니다.',
      '`contactPoint`에 전화번호, 이메일을 구조화하면 고객 서비스 리치 결과가 가능합니다.'
    ]
  },
  LocalBusiness: {
    label: '지역업체', required: ['name','address','url'],
    recommended: ['telephone','openingHours','geo','image','priceRange','aggregateRating','review'],
    address_required: ['streetAddress','addressLocality','addressRegion','postalCode','addressCountry'],
    tips: [
      '`geo`(위도/경도)는 Google Maps 정확한 위치 표시에 필수입니다.',
      '`openingHoursSpecification`을 사용하면 요일별 영업시간을 더 정밀하게 표현할 수 있습니다.',
      '`address`의 각 필드를 분리해서 작성하면 구글이 더 정확하게 파싱합니다.'
    ]
  },
  WebSite: {
    label: '웹사이트', required: ['name','url'],
    recommended: ['potentialAction','description'],
    tips: [
      '`potentialAction`(SearchAction)을 추가하면 사이트 검색창 리치 결과가 가능합니다.',
      '홈페이지에만 WebSite 마크업을 넣으세요 — 모든 페이지에 넣을 필요 없습니다.'
    ]
  },
  Event: {
    label: '이벤트', required: ['name','startDate','location'],
    recommended: ['endDate','description','image','offers','performer','organizer','eventStatus','eventAttendanceMode'],
    tips: [
      '`eventStatus`는 예정, 취소, 연기 등을 명시하세요.',
      '`eventAttendanceMode`는 온라인/오프라인/혼합 여부를 표시합니다.',
      '`offers`에 가격과 판매 URL을 포함하면 이벤트 카드에 구매 링크가 표시됩니다.'
    ]
  },
  Recipe: {
    label: '레시피', required: ['name','image'],
    recommended: ['author','datePublished','description','prepTime','cookTime','totalTime','recipeYield','recipeIngredient','recipeInstructions','nutrition','aggregateRating'],
    tips: [
      '`recipeInstructions`는 HowToStep 배열로 작성하면 단계별 리치 결과가 가능합니다.',
      '`image`는 최소 3장(1:1, 4:3, 16:9)을 제공하면 다양한 SERP에 대응합니다.',
      '`nutrition.calories`는 Google이 자주 표시하는 필드입니다.'
    ]
  },
  VideoObject: {
    label: '동영상', required: ['name','description','thumbnailUrl','uploadDate'],
    recommended: ['contentUrl','embedUrl','duration','interactionStatistic','expires','hasPart'],
    tips: [
      '`thumbnailUrl`은 최소 160x90px, 권장 1920x1080px입니다.',
      '`duration`은 ISO 8601 형식(PT1H30M)으로 작성하세요.',
      '`hasPart`(Clip)를 추가하면 "핵심 순간" 리치 결과가 가능합니다.'
    ]
  },
  HowTo: {
    label: '사용법', required: ['name','step'],
    recommended: ['image','description','totalTime','estimatedCost','supply','tool'],
    tips: ['각 `step`은 `HowToStep`으로 `name`과 `text`를 포함해야 합니다.','단계별 이미지를 추가하면 비주얼 가이드 리치 결과가 됩니다.']
  },
  Review: {
    label: '리뷰', required: ['itemReviewed','author','reviewRating'],
    recommended: ['datePublished','reviewBody','publisher'],
    tips: ['`reviewRating`에 `bestRating`, `worstRating`을 명시하면 비표준 척도도 표현됩니다.','`author`가 Person이면 E-E-A-T 신호가 더 강합니다.']
  },
  SoftwareApplication: {
    label: '소프트웨어', required: ['name','offers'],
    recommended: ['applicationCategory','operatingSystem','aggregateRating','review','screenshot','description'],
    tips: ['`applicationCategory`는 GameApplication, WebApplication 등 구체적으로 작성하세요.','무료 앱도 `offers.price`를 "0"으로 명시해야 합니다.']
  },
  Course: {
    label: '강좌', required: ['name','description','provider'],
    recommended: ['hasCourseInstance','offers','coursePrerequisites','educationalLevel','image','aggregateRating'],
    tips: ['`hasCourseInstance`로 수강 기간, 일정을 구조화하면 리치 결과에 표시됩니다.','`provider`는 Organization 타입으로 기관명과 URL을 포함하세요.']
  },
  JobPosting: {
    label: '채용공고', required: ['title','description','datePosted','hiringOrganization','jobLocation'],
    recommended: ['baseSalary','employmentType','validThrough','applicantLocationRequirements','jobLocationType','directApply'],
    tips: ['`baseSalary`를 포함하면 Google for Jobs에서 급여 필터에 노출됩니다.','`validThrough`가 지나면 자동으로 리치 결과에서 제외됩니다.','`jobLocationType`을 "TELECOMMUTE"로 설정하면 재택근무 필터에 포함됩니다.']
  }
};
