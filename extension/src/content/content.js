// DopaQueue content script — runs on youtube.com/watch* and shorts pages.
// Classic script (no ES module imports: MV3 content scripts can't be
// declared as modules), so it's fully self-contained.
//
// Scrapes the video's genre/category, channel name, and transcript
// straight from page metadata / ytInitialPlayerResponse and hands
// them to the background script, which caches them by URL.

function scrapeCategory() {
  const genreMeta = document.querySelector('meta[itemprop="genre"]');
  if (genreMeta?.content) return genreMeta.content;

  const keywordsMeta = document.querySelector('meta[name="keywords"]');
  if (keywordsMeta?.content) {
    const first = keywordsMeta.content.split(',')[0]?.trim();
    if (first) return first;
  }

  return null;
}

function scrapeChannel() {
  const linkName = document.querySelector('link[itemprop="name"]');
  if (linkName?.content) return linkName.content;

  const authorLink = document.querySelector('span[itemprop="author"] link[itemprop="name"]');
  if (authorLink?.content) return authorLink.content;

  return null;
}

async function scrapeTranscript() {
  try {
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const script of scripts) {
      if (script.textContent.includes('ytInitialPlayerResponse')) {
        const match = script.textContent.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
        if (match) {
          const data = JSON.parse(match[1]);
          const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          if (tracks && tracks.length > 0) {
            // Prefer English, fall back to first track
            const enTrack = tracks.find(t => t.languageCode === 'en') || tracks[0];
            const url = enTrack.baseUrl;
            const res = await fetch(url);
            const xml = await res.text();

            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const texts = Array.from(doc.getElementsByTagName('text'));
            return texts.map(t => t.textContent).join(' ');
          }
        }
      }
    }
  } catch (e) {
    console.error('DopaQueue: Error scraping transcript', e);
  }
  return null;
}

async function scrapeAll() {
  const url = location.href;
  const genre = scrapeCategory();
  const channel = scrapeChannel();
  const transcript = await scrapeTranscript();

  return { url, genre, channel, transcript };
}

async function sendScrapeResult() {
  const url = location.href;
  if (!/\/watch/.test(location.pathname) && !/\/shorts\//.test(location.pathname)) return;

  const result = await scrapeAll();

  if (!result.genre && !result.channel && !result.transcript) return;

  chrome.runtime.sendMessage({
    type: 'GENRE_SCRAPED',
    ...result,
  });
}

// Listen for on-demand scrape requests from the popup/background.
// This fires when the user clicks "Save" so the transcript is
// fetched immediately at save time rather than only on page visit.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SCRAPE_NOW') {
    scrapeAll().then((result) => {
      // Also send to background to cache it
      chrome.runtime.sendMessage({
        type: 'GENRE_SCRAPED',
        ...result,
      });
      sendResponse(result);
    }).catch((err) => {
      console.error('DopaQueue: on-demand scrape failed', err);
      sendResponse({ url: location.href, genre: null, channel: null, transcript: null });
    });
    return true; // keep channel open for async response
  }
});

// Initial load.
sendScrapeResult();

// YouTube is a single-page app: navigating between videos fires this
// custom event instead of a full page (and content script) reload.
document.addEventListener('yt-navigate-finish', () => {
  setTimeout(sendScrapeResult, 500);
});
