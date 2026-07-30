// @ts-nocheck
// Central Orchestrator for DopaQueue Content Scripts

import { scrapeMetadataOnly, initInstagramButtons, universalScrapeAll } from './platforms/instagram.js';
import { scrapeYouTube, injectYouTubeShortsButtons } from './platforms/youtube.js';
import { initTextPlatformButtons } from './platforms/text_platforms.js';
import { initTikTokButtons } from './platforms/tiktok.js';
import { initScrollTimer } from './features/timer.js';
import { checkMindfulFlowBreaker } from './features/flowBreaker.js';
// Article extractor and image save scripts set up their own listeners
import './features/articleExtractor.js';
import './features/imageSave.js';

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

    const scrapePromise = isYouTube ? scrapeYouTube() : universalScrapeAll();
    
    if (scrapePromise instanceof Promise) {
      scrapePromise.then(data => {
        sendResponse(data);
        if (data && (data.genre || data.channel || data.transcript || data.thumbnail)) {
          try { chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...data }); } catch (e) { }
        }
      });
    } else {
      sendResponse(scrapePromise);
    }

    return true;
  }

  // Screenshot area selection messages are handled in screenshotCapture.ts
  // which is injected dynamically by the background worker via scripting.executeScript
});

// Initial load
sendScrapeResult();
checkMindfulFlowBreaker();
initInstagramButtons();
injectYouTubeShortsButtons();
initScrollTimer();

// TikTok
if (location.hostname.includes('tiktok.com')) {
  initTikTokButtons();
}

// YouTube SPA navigation
document.addEventListener('yt-navigate-finish', () => {
  try {
    const meta = scrapeMetadataOnly();
    if (meta?.url) chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...meta });
  } catch (e) { }

  setTimeout(sendScrapeResult, 800);
  setTimeout(checkMindfulFlowBreaker, 600);
});
