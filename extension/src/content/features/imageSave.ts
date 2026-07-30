// @ts-nocheck
// DopaQueue Image Save Handler
// Listens for SAVE_IMAGE_FROM_CONTEXT messages triggered by the context menu
// and enriches the save with surrounding page context.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SAVE_IMAGE_FROM_CONTEXT') {
    const imgUrl: string = message.srcUrl;
    if (!imgUrl) { sendResponse({ success: false }); return; }

    // Enrich: find the img element on the page and get surrounding context
    const imgEl = Array.from(document.querySelectorAll('img')).find(
      (img) => img.src === imgUrl || img.currentSrc === imgUrl
    );

    const altText = imgEl?.alt?.trim() || null;

    // Look for a <figure> caption
    const figCaption = imgEl?.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || null;

    // Best title: caption > alt > og:title > page title
    const title =
      figCaption ||
      altText ||
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.title ||
      'Saved Image';

    const sourceDomain = location.hostname.replace(/^www\./, '');

    chrome.runtime.sendMessage({
      type: 'SAVE_ITEM',
      url: imgUrl,
      title: title.slice(0, 200),
      thumbnail: imgUrl,
      altText,
      platform: detectPlatform(location.hostname),
      contentType: 'image',
      sourceDomain,
      fromContentScript: true,
      // sourcePageUrl stored so user can navigate back to the original page
      description: `Saved from ${location.href}`,
    });

    sendResponse({ success: true });
    return true;
  }
});

function detectPlatform(hostname: string): string {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
  if (h.includes('instagram.com')) return 'instagram';
  if (h.includes('tiktok.com')) return 'tiktok';
  if (h.includes('twitter.com') || h.includes('x.com')) return 'x';
  if (h.includes('reddit.com')) return 'reddit';
  if (h.includes('linkedin.com')) return 'linkedin';
  return 'web';
}
