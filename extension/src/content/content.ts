// @ts-nocheck
import { scrapeMetadataOnly, initInstagramButtons, universalScrapeAll } from './platforms/instagram.js';
import { scrapeYouTube, injectYouTubeShortsButtons } from './platforms/youtube.js';
import { initTextPlatformButtons } from './platforms/text_platforms.js';
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

    // Use universalScrapeAll so we get the base64 thumbnail for the popup
    const scrapePromise = isYouTube ? scrapeYouTube() : universalScrapeAll();
    
    if (scrapePromise instanceof Promise) {
      scrapePromise.then(data => {
        sendResponse(data);
        // Fire-and-forget: send full scrape to background
        if (data && (data.genre || data.channel || data.transcript || data.thumbnail)) {
          try { chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...data }); } catch (e) { }
        }
      });
    } else {
      sendResponse(scrapePromise);
    }

    return true; // Keep message channel open for async response
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

