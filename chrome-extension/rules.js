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
  },
  Book: {
    label: '도서', required: ['name','author','workExample'],
    recommended: ['url','sameAs','image','description','aggregateRating','review'],
    workExample_required: ['isbn','bookFormat'],
    tips: ['`workExample`에 isbn(ISBN-13)을 반드시 포함해야 Google Books 리치 결과에 노출됩니다.','`bookFormat`은 EBook, Hardcover, Paperback, AudiobookFormat 중 하나를 사용하세요.']
  },
  Movie: {
    label: '영화', required: ['name','image','dateCreated'],
    recommended: ['director','actor','description','duration','aggregateRating','review','genre','contentRating','sameAs'],
    director_required: ['name'], aggregateRating_required: ['ratingValue','bestRating','ratingCount'],
    tips: ['`aggregateRating`을 포함하면 검색 결과에 별점이 표시됩니다.','`duration`은 ISO 8601 형식(PT2H30M)으로 작성하세요.']
  },
  MusicGroup: {
    label: '음악 그룹', required: ['name','url'],
    recommended: ['image','sameAs','genre','album','description','member'],
    tips: ['`sameAs`에 Spotify, Apple Music 등 스트리밍 프로필을 포함하면 Knowledge Panel 생성에 유리합니다.']
  },
  Dataset: {
    label: '데이터셋', required: ['name','description'],
    recommended: ['url','keywords','license','creator','distribution','temporalCoverage','spatialCoverage','datePublished'],
    creator_required: ['name'], distribution_required: ['contentUrl'],
    tips: ['Google Dataset Search에 노출되려면 `name`과 `description`이 명확해야 합니다.','`distribution`에 다운로드 URL과 파일 형식을 명시하세요.']
  },
  SpecialAnnouncement: {
    label: '긴급 공지', required: ['name','datePosted','text'],
    recommended: ['expires','category','spatialCoverage','announcementLocation','url'],
    tips: ['긴급 상황(공중보건, 자연재해)에서만 사용하세요.','`expires`를 반드시 설정하여 만료된 공지가 계속 노출되지 않도록 하세요.']
  },
  ClaimReview: {
    label: '팩트체크', required: ['claimReviewed','reviewRating','author','itemReviewed'],
    recommended: ['url','datePublished','image'],
    reviewRating_required: ['ratingValue','bestRating','worstRating','alternateName'],
    author_required: ['name','url'],
    tips: ['`claimReviewed`에 검증 대상 주장을 정확히 인용하세요.','`reviewRating.alternateName`에 사실/거짓 등 평가를 명시하세요.']
  },
  EducationalOccupationalProgram: {
    label: '교육/직업 프로그램', required: ['name','description','provider','educationalProgramMode','timeToComplete'],
    recommended: ['url','offers','programPrerequisites','occupationalCategory','salaryUponCompletion'],
    provider_required: ['name','url','address'],
    tips: ['`educationalProgramMode`에 IN_PERSON, ONLINE, HYBRID 중 하나를 명시하세요.','`timeToComplete`는 ISO 8601 Duration(P2Y, P6M)으로 작성하세요.']
  },
  LearningResource: {
    label: '학습 자료', required: ['name','description','educationalLevel'],
    recommended: ['author','publisher','datePublished','learningResourceType','teaches','inLanguage','isAccessibleForFree'],
    tips: ['`educationalLevel`에 대상 학습 수준을 명시하세요.','`learningResourceType`에 lesson plan, worksheet, video 등 자료 유형을 지정하세요.']
  },
  MerchantListing: {
    label: '판매자 목록', required: ['name','image','offers'],
    recommended: ['description','brand','sku','gtin','aggregateRating','shippingDetails','hasMerchantReturnPolicy'],
    offers_required: ['price','priceCurrency','availability'],
    tips: ['Google 쇼핑 무료 등록에 사용되는 핵심 마크업입니다.','`shippingDetails`와 `hasMerchantReturnPolicy`를 포함하면 쇼핑 탭 노출 확률이 높아집니다.']
  },
  VacationRental: {
    label: '숙박시설', required: ['name','image','address','offers'],
    recommended: ['description','url','geo','amenityFeature','numberOfRooms','aggregateRating','checkinTime','checkoutTime'],
    address_required: ['streetAddress','addressLocality','addressRegion','postalCode','addressCountry'],
    offers_required: ['price','priceCurrency','availability'],
    tips: ['`address`와 `geo`를 정확히 기재하면 지역 기반 숙박 검색에 노출됩니다.','이미지는 최소 3장 이상 다양한 각도를 제공하세요.']
  },
  Vehicle: {
    label: '차량', required: ['name','image','offers','brand','model','vehicleIdentificationNumber'],
    recommended: ['description','color','vehicleModelDate','mileageFromOdometer','fuelType','vehicleTransmission','itemCondition'],
    offers_required: ['price','priceCurrency','availability'],
    tips: ['VIN은 중고차 거래에서 Google 리치 결과의 핵심 식별자입니다.','`fuelType`에 Gasoline, Diesel, Electric, Hybrid 등을 명시하세요.']
  },
  ProfilePage: {
    label: '프로필 페이지', required: ['name','mainEntity'],
    recommended: ['dateCreated','dateModified','description','image','url'],
    mainEntity_required: ['name','url'],
    tips: ['`mainEntity`에 Person 또는 Organization 타입으로 프로필 소유자를 명시하세요.','Google은 ProfilePage를 E-E-A-T의 경험(Experience) 시그널로 활용합니다.']
  },
  DiscussionForumPosting: {
    label: '포럼 게시글', required: ['headline','author','datePublished'],
    recommended: ['text','url','dateModified','comment','interactionStatistic','isPartOf','about'],
    author_required: ['name','url'],
    tips: ['2024년 Google이 추가한 비교적 새로운 리치 결과 타입입니다.','`comment`에 답글을 구조화하면 검색 결과에 토론 미리보기가 표시됩니다.']
  }
};
