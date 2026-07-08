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
  // Robust transcript scraping strategy:
  // 1) Try to extract `ytInitialPlayerResponse` from inline scripts (balanced-brace parser)
  //    and use captionTracks if present.
  // 2) Fallback: query YouTube's timedtext list endpoint for the video id and fetch
  //    the first track.
  // 3) If fetches are blocked by CORS when executed from the extension context,
  //    inject a small page-script fetcher that runs in the page origin and returns
  //    results via `window.postMessage`.
  try {
    function extractPlayerResponse() {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const txt = script.textContent || '';
        const idx = txt.indexOf('ytInitialPlayerResponse');
        if (idx === -1) continue;
        const braceStart = txt.indexOf('{', idx);
        if (braceStart === -1) continue;
        // Balanced-brace parse to find the full JSON object
        let depth = 0;
        let i = braceStart;
        for (; i < txt.length; i++) {
          const ch = txt[i];
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
        if (i <= braceStart) continue;
        const jsonText = txt.slice(braceStart, i + 1);
        try { return JSON.parse(jsonText); } catch (e) { continue; }
      }
      return null;
    }

    function extractVideoIdFromUrl(u) {
      // handles watch?v=, youtu.be/, /shorts/, and full watch URLs
      const m1 = u.match(/[?&]v=([A-Za-z0-9_-]{11})/);
      if (m1) return m1[1];
      const m2 = u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
      if (m2) return m2[1];
      const m3 = u.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
      if (m3) return m3[1];
      return null;
    }

    // Fetch helper with a hard timeout. If the in-page fetch fails (CORS),
    // fall back to asking the background service worker to fetch — it is
    // not subject to the page's CORS/CSP for hosts in host_permissions,
    // and unlike inline <script> injection it isn't blocked by YouTube's CSP.
    function pageFetch(url) {
      return new Promise((resolve, reject) => {
        const timeoutMs = 8000;
        let settled = false;
        const settle = (fn, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          fn(value);
        };
        const timeout = setTimeout(() => {
          settle(reject, new Error('fetch timed out'));
        }, timeoutMs);

        fetch(url, { credentials: 'same-origin' })
          .then((res) => res.text())
          .then((text) => settle(resolve, { ok: true, text }))
          .catch(() => {
            try {
              chrome.runtime.sendMessage({ type: 'PAGE_FETCH', url }, (res) => {
                if (chrome.runtime.lastError) {
                  settle(reject, new Error(chrome.runtime.lastError.message));
                  return;
                }
                if (res && res.ok) settle(resolve, { ok: true, text: res.text });
                else settle(reject, new Error((res && res.error) || 'fetch failed'));
              });
            } catch (ex) {
              settle(reject, ex);
            }
          });
      });
    }

    function parseTimedTextXml(xmlText) {
      try {
        const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        const texts = Array.from(doc.getElementsByTagName('text'));
        return texts.map(t => t.textContent).join(' ');
      } catch (e) { return null; }
    }

    // 1) Try player response
    const player = extractPlayerResponse();
    if (player) {
      const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && tracks.length > 0) {
        const enTrack = tracks.find(t => t.languageCode === 'en') || tracks[0];
        if (enTrack?.baseUrl) {
          try {
            const r = await pageFetch(enTrack.baseUrl);
            if (r?.ok) return parseTimedTextXml(r.text);
          } catch (e) {
            // fallthrough to next strategies
          }
        }
      }
    }

    // 2) Fallback: ask YouTube timedtext list endpoint for available tracks
    const vid = extractVideoIdFromUrl(location.href);
    if (vid) {
      try {
        const listUrl = `/api/timedtext?type=list&v=${vid}`;
        const lr = await pageFetch(listUrl);
        if (lr?.ok) {
          const listDoc = new DOMParser().parseFromString(lr.text, 'text/xml');
          const track = listDoc.querySelector('track[lang_code]');
          if (track) {
            const trackUrl = track.getAttribute('url') || track.getAttribute('src') || null;
            const full = trackUrl ? (trackUrl.startsWith('http') ? trackUrl : `${location.origin}${trackUrl}`) : null;
            if (full) {
              try {
                const tr = await pageFetch(full);
                if (tr?.ok) return parseTimedTextXml(tr.text);
              } catch (e) {
                // ignore and continue
              }
            }
          }
        }
      } catch (e) {
        // ignore
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
    // Attempt an immediate scrape; if transcript is missing (common while
    // ads or player initialization are happening), poll for up to a few
    // seconds and return the first non-null transcript found.
    (async () => {
      // Exponential backoff retry: 1s,1s,2s,4s,... up to a max attempts cap
      const maxAttempts = 12;
      let attempt = 0;
      let lastResult = null;
      while (attempt < maxAttempts) {
        try {
          const res = await scrapeAll();
          lastResult = res;
          // Send detailed attempt log to background for centralized tracing
          try {
            chrome.runtime.sendMessage({
              type: 'SCRAPE_ATTEMPT',
              url: location.href,
              attempt: attempt + 1,
              maxAttempts,
              success: !!(res.transcript || res.genre || res.channel),
              hasTranscript: !!res.transcript,
              transcriptLength: res.transcript ? res.transcript.length : 0,
              reason: 'success',
              timestamp: Date.now(),
            });
          } catch (e) {}

          // Only stop early once we actually have a transcript — genre and
          // channel are available immediately, but the transcript is the
          // whole reason for this retry/backoff loop.
          if (res.transcript) break;
        } catch (err) {
          // Send failure with reason
          try {
            chrome.runtime.sendMessage({
              type: 'SCRAPE_ATTEMPT',
              url: location.href,
              attempt: attempt + 1,
              maxAttempts,
              success: false,
              reason: String(err.message || err),
              timestamp: Date.now(),
            });
          } catch (e) {}
          console.warn('DopaQueue: scrape attempt failed', err);
        }
        attempt++;
        // exponential backoff delay
        const delayMs = Math.min(8000, 500 * (2 ** Math.max(0, attempt - 1)));
        await new Promise(r => setTimeout(r, delayMs));
      }

      // Send to background to cache it
      try {
        chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...(lastResult || { url: location.href }) }, () => {});
      } catch (e) {
        console.warn('DopaQueue: failed to send GENRE_SCRAPED', e);
      }

      sendResponse(lastResult || { url: location.href, genre: null, channel: null, transcript: null });
    })();
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
