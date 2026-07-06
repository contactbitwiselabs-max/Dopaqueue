// DopaQueue content script — runs on youtube.com/watch* pages.
// Classic script (no ES module imports: MV3 content scripts can't be
// declared as modules), so it's fully self-contained.
//
// Scrapes the video's genre/category and channel name straight from
// page metadata and hands them to the background script, which caches
// them by URL so the popup can attach a category to a saved video
// without needing its own YouTube API key.

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
            const url = tracks[0].baseUrl;
            const res = await fetch(url);
            const xml = await res.text();
            
            // Very simple XML parser: strip all tags and decode HTML entities
            // e.g. <text start="1" dur="2">Hello &amp; world</text> -> Hello & world
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

async function sendScrapeResult() {
  const url = location.href;
  if (!/\/watch/.test(location.pathname)) return;

  const genre = scrapeCategory();
  const channel = scrapeChannel();
  const transcript = await scrapeTranscript();
  
  if (!genre && !channel && !transcript) return;

  chrome.runtime.sendMessage({
    type: 'GENRE_SCRAPED',
    url,
    genre,
    channel,
    transcript,
  });
}

// Initial load.
sendScrapeResult();

// YouTube is a single-page app: navigating between videos fires this
// custom event instead of a full page (and content script) reload.
document.addEventListener('yt-navigate-finish', () => {
  // Metadata tags update asynchronously right after navigation; a short
  // delay avoids racing the DOM update.
  setTimeout(sendScrapeResult, 500);
});
