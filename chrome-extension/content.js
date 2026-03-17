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

function extractContent() {
  let wordCount = 0;
  try {
    const bodyText = (document.body.innerText || '').trim();
    // Split on whitespace; works for Latin and CJK (CJK chars count as 1 each)
    const latinWords = bodyText.split(/\s+/).filter(w => w.length > 0).length;
    // Count CJK characters individually (rough approximation)
    const cjkChars = (bodyText.match(/[\u3000-\u9fff\uac00-\ud7af]/g) || []).length;
    wordCount = latinWords + cjkChars;
  } catch (e) {
    wordCount = 0;
  }

  const images = document.querySelectorAll('img');
  let imagesWithAlt = 0;
  try {
    images.forEach(img => {
      const alt = (img.getAttribute('alt') || '').trim();
      if (alt.length > 0) imagesWithAlt++;
    });
  } catch (e) {
    // keep 0
  }

  const links = document.querySelectorAll('a[href]');
  let externalLinks = 0;
  let internalLinks = 0;
  const currentHost = window.location.hostname;
  try {
    links.forEach(a => {
      const href = a.getAttribute('href') || '';
      // Skip anchors, javascript:, mailto:, tel:
      if (href.startsWith('#') || href.startsWith('javascript:') ||
          href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      try {
        const url = new URL(href, window.location.origin);
        if (url.hostname && url.hostname !== currentHost) {
          externalLinks++;
        } else {
          internalLinks++;
        }
      } catch (e) {
        internalLinks++; // relative URLs are internal
      }
    });
  } catch (e) {
    // keep 0s
  }

  // FAQ detection: look for FAQ schema, or elements with FAQ-like patterns
  let hasFaq = false;
  try {
    // Check in JSON-LD
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      if (s.textContent.includes('FAQPage')) { hasFaq = true; break; }
    }
    // Check for common FAQ HTML patterns
    if (!hasFaq) {
      hasFaq = !!(
        document.querySelector('[itemtype*="FAQPage"]') ||
        document.querySelector('.faq, .faqs, #faq, #faqs, [class*="faq"], [id*="faq"]') ||
        document.querySelector('details summary') ||
        document.querySelector('[role="accordion"]')
      );
    }
  } catch (e) {
    // keep false
  }

  // HowTo detection: look for HowTo schema or step-like structures
  let hasHowTo = false;
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      if (s.textContent.includes('HowTo')) { hasHowTo = true; break; }
    }
    if (!hasHowTo) {
      hasHowTo = !!(
        document.querySelector('[itemtype*="HowTo"]') ||
        document.querySelector('.steps, .step, [class*="step"], ol.instructions, [class*="how-to"]')
      );
    }
  } catch (e) {
    // keep false
  }

  return {
    wordCount,
    paragraphCount: document.querySelectorAll('p').length,
    imageCount: images.length,
    imagesWithAlt,
    linkCount: links.length,
    externalLinks,
    internalLinks,
    tables: document.querySelectorAll('table').length,
    lists: document.querySelectorAll('ul, ol').length,
    hasFaq,
    hasHowTo
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'extractJsonLd') {
      // Backward compatible: return just jsonlds
      const jsonlds = extractJsonLds();
      sendResponse({ jsonlds, url: window.location.href, title: document.title });

    } else if (request.action === 'extractAll') {
      const jsonlds = extractJsonLds();
      sendResponse({
        url: window.location.href,
        title: document.title,
        jsonlds,
        meta: extractMeta(jsonlds),
        headings: extractHeadings(),
        content: extractContent()
      });
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
  return true; // keep message channel open for async
});
