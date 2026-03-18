// Content script: extracts JSON-LD and GEO analysis data from the page DOM

function extractJsonLds() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const results = [];
  scripts.forEach(script => {
    try {
      const parsed = JSON.parse(script.textContent.trim());
      if (Array.isArray(parsed)) results.push(...parsed);
      else if (parsed['@graph']) results.push(...parsed['@graph']);
      else results.push(parsed);
    } catch (e) {
      // skip malformed JSON-LD
    }
  });
  return results;
}

function getMetaContent(nameOrProperty) {
  try {
    const el =
      document.querySelector(`meta[name="${nameOrProperty}"]`) ||
      document.querySelector(`meta[property="${nameOrProperty}"]`);
    return el ? el.getAttribute('content') || '' : '';
  } catch (e) {
    return '';
  }
}

function extractMeta(jsonlds) {
  // Attempt to pull datePublished / dateModified from JSON-LD if not in meta
  let datePublished = getMetaContent('article:published_time') || getMetaContent('datePublished');
  let dateModified = getMetaContent('article:modified_time') || getMetaContent('dateModified');

  if (!datePublished || !dateModified) {
    for (const ld of jsonlds) {
      try {
        if (!datePublished && ld.datePublished) datePublished = ld.datePublished;
        if (!dateModified && ld.dateModified) dateModified = ld.dateModified;
        if (datePublished && dateModified) break;
      } catch (e) {
        // skip
      }
    }
  }

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const htmlEl = document.documentElement;

  return {
    title: document.title || '',
    description: getMetaContent('description'),
    canonical: canonicalEl ? canonicalEl.getAttribute('href') || '' : '',
    robots: getMetaContent('robots'),
    ogTitle: getMetaContent('og:title'),
    ogDescription: getMetaContent('og:description'),
    ogImage: getMetaContent('og:image'),
    ogType: getMetaContent('og:type'),
    ogUrl: getMetaContent('og:url'),
    twitterCard: getMetaContent('twitter:card'),
    twitterTitle: getMetaContent('twitter:title'),
    twitterDescription: getMetaContent('twitter:description'),
    twitterImage: getMetaContent('twitter:image'),
    author: getMetaContent('author'),
    datePublished: datePublished || '',
    dateModified: dateModified || '',
    lang: (htmlEl.getAttribute('lang') || getMetaContent('language') || '').trim(),
    viewport: getMetaContent('viewport')
  };
}

function extractHeadings() {
  const headings = {};
  const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  levels.forEach(tag => {
    try {
      headings[tag] = Array.from(document.querySelectorAll(tag)).map(
        el => (el.textContent || '').trim()
      );
    } catch (e) {
      headings[tag] = [];
    }
  });

  // Check hierarchy: headings should appear in non-decreasing order
  // (e.g. h1 before h2, no h3 without a preceding h2)
  let hierarchy = true;
  try {
    const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let maxLevelSeen = 0; // 0 = none seen yet
    for (const el of allHeadings) {
      const level = parseInt(el.tagName.charAt(1), 10);
      if (level > maxLevelSeen + 1) {
        // Skipped a level (e.g. h1 -> h3 with no h2)
        hierarchy = false;
        break;
      }
      if (level > maxLevelSeen) maxLevelSeen = level;
    }
  } catch (e) {
    hierarchy = false;
  }

  headings.hierarchy = hierarchy;
  return headings;
}

function extractContent(jsonlds) {
  let wordCount = 0;
  try {
    const bodyText = (document.body.innerText || '').trim();
    const latinWords = bodyText.split(/\s+/).filter(w => w.length > 0).length;
    const cjkChars = (bodyText.match(/[\u3000-\u9fff\uac00-\ud7af]/g) || []).length;
    wordCount = latinWords + cjkChars;
  } catch (e) {
    wordCount = 0;
  }

  const images = document.querySelectorAll('img');
  let imagesWithAlt = 0;
  try {
    images.forEach(img => {
      if ((img.getAttribute('alt') || '').trim().length > 0) imagesWithAlt++;
    });
  } catch (e) {}

  let externalLinks = 0;
  const currentHost = window.location.hostname;
  try {
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#') || href.startsWith('javascript:') ||
          href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.hostname && url.hostname !== currentHost) externalLinks++;
      } catch (e) {}
    });
  } catch (e) {}

  // FAQ/HowTo 감지: 이미 파싱된 jsonlds에서 @type 확인 → DOM 폴백
  const types = (jsonlds || []).map(ld => {
    let t = ld['@type']; if (Array.isArray(t)) t = t[0]; return t || '';
  });
  let hasFaq = types.some(t => t === 'FAQPage');
  let hasHowTo = types.some(t => t === 'HowTo');
  try {
    if (!hasFaq) {
      hasFaq = !!(
        document.querySelector('[itemtype*="FAQPage"]') ||
        document.querySelector('.faq, .faqs, #faq, #faqs, [class*="faq"], [id*="faq"]') ||
        document.querySelector('details summary')
      );
    }
    if (!hasHowTo) {
      hasHowTo = !!(
        document.querySelector('[itemtype*="HowTo"]') ||
        document.querySelector('.steps, .step, [class*="step"], ol.instructions, [class*="how-to"]')
      );
    }
  } catch (e) {}

  return {
    wordCount,
    imageCount: images.length,
    imagesWithAlt,
    externalLinks,
    tables: document.querySelectorAll('table').length,
    lists: document.querySelectorAll('ul, ol').length,
    hasFaq,
    hasHowTo
  };
}

async function fetchRobotsTxt() {
  try {
    const robotsUrl = new URL('/robots.txt', window.location.origin).href;
    const resp = await fetch(robotsUrl, { cache: 'no-cache', credentials: 'omit' });
    if (resp.ok) {
      const text = await resp.text();
      // 기본 검증: robots.txt가 실제 텍스트 파일인지 (HTML 반환 방지)
      if (text.length > 0 && !text.trimStart().startsWith('<!') && !text.trimStart().startsWith('<html')) {
        return text;
      }
    }
  } catch (e) {
    // 네트워크 오류, CORS 등
  }
  return null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ error: 'Unauthorized sender' });
    return true;
  }
  try {
    if (request.action === 'extractAll') {
      const jsonlds = extractJsonLds();
      sendResponse({
        url: window.location.href,
        title: document.title,
        jsonlds,
        meta: extractMeta(jsonlds),
        headings: extractHeadings(),
        content: extractContent(jsonlds)
      });

    } else if (request.action === 'fetchRobotsTxt') {
      // 비동기 응답
      fetchRobotsTxt().then(text => sendResponse({ robotsTxt: text }));
      return true; // keep channel open for async
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
  return true;
});
