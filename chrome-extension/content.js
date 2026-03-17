// Content script: extracts JSON-LD from the page DOM
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractJsonLd') {
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
    sendResponse({ jsonlds: results, url: window.location.href, title: document.title });
  }
  return true; // keep message channel open for async
});
