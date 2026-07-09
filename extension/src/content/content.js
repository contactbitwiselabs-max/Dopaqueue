import { scrapeMetadataOnly, initInstagramButtons, universalScrapeAll } from './platforms/instagram.js';
import { scrapeYouTube, injectYouTubeShortsButtons } from './platforms/youtube.js';
import { initScrollTimer } from './features/timer.js';
import { checkMindfulFlowBreaker } from './features/flowBreaker.js';

// Central Orchestrator for DopaQueue Content Scripts

async function sendScrapeResult() {
  const url = location.href;
  const isYouTube = location.hostname.includes('youtube.com');
  
  if (isYouTube && !/\/watch/.test(location.pathname) && !/\/shorts\//.test(location.pathname)) return;
  
  const result = isYouTube ? await scrapeYouTube() : await universalScrapeAll();
  
  if (!result || (!result.genre && !result.channel && !result.transcript && !result.thumbnail)) return;
  try {
    chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...result });
  } catch (e) { }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SCRAPE_NOW') {
    const isYouTube = location.hostname.includes('youtube.com');

    // Respond INSTANTLY with live DOM metadata — never wait for transcript
    const metadata = isYouTube ? scrapeYouTube() : scrapeMetadataOnly();
    
    // YouTube scraper is always async, so we just wait for it. Metadata scraper is sync.
    if (metadata instanceof Promise) {
      metadata.then(data => sendResponse(data));
    } else {
      sendResponse(metadata);
    }

    // Fire-and-forget: send full scrape (with transcript) to background
    (async () => {
      try {
        const full = isYouTube ? await scrapeYouTube() : await universalScrapeAll();
        chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...full });
      } catch (e) { }
    })();

    return true; // async response
  }
});

// Initial load
sendScrapeResult();
checkMindfulFlowBreaker();
initInstagramButtons();
injectYouTubeShortsButtons();
initScrollTimer();

// YouTube SPA navigation
document.addEventListener('yt-navigate-finish', () => {
  // Immediately push fast metadata to the popup
  try {
    const meta = scrapeMetadataOnly();
    if (meta?.url) chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...meta });
  } catch (e) { }

  // Full scrape (with transcript) fires 800ms later
  setTimeout(sendScrapeResult, 800);
  setTimeout(checkMindfulFlowBreaker, 600);
});
