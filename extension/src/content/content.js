// DopaQueue content script — runs on youtube.com/watch* and shorts pages.
// Classic script (no ES module imports: MV3 content scripts can't be
// declared as modules), so it's fully self-contained.
//
// Transcript pipeline (all strategies attempted in parallel or sequentially
// with a hard 12s global timeout so the popup never spins indefinitely):
//
// Strategy A — DOM inline script balanced-brace parse for ytInitialPlayerResponse
//              This is the fastest path and works on initial page loads.
// Strategy B — Background service-worker fetch of the watch page HTML,
//              which is not subject to CSP / CORS restrictions.
//              Parses ytInitialPlayerResponse with the same balanced-brace technique.
// Strategy C — YouTube Timedtext API: /api/timedtext?v=VIDEO_ID&lang=LANG
//              Works without ytInitialPlayerResponse for auto-generated captions.
//              Tries English first, then all other detected languages.
//
// All three run in parallel via Promise.any(). First non-null transcript wins.
// genre and channel are scraped from the DOM immediately (synchronous) before
// any async transcript work starts, with a background fetch fallback for those too.

const TRANSCRIPT_TIMEOUT_MS = 12000; // Hard cap — popup spinner stops after this

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractVideoId(url) {
  const m1 = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m1) return m1[1];
  const m2 = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m2) return m2[1];
  const m3 = url.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
  if (m3) return m3[1];
  return null;
}

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

/** Parse YouTube timedtext XML into a plain text string */
function parseTimedTextXml(xmlText) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const texts = Array.from(doc.getElementsByTagName('text'));
    const joined = texts
      .map(t => (t.textContent || '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ').trim()
      )
      .filter(Boolean)
      .join(' ');
    return joined.length > 30 ? joined : null;
  } catch (e) {
    return null;
  }
}

/** Extract captionTracks from a ytInitialPlayerResponse object */
function getTrackList(player) {
  return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
}

/** DOM balanced-brace search for ytInitialPlayerResponse */
function extractPlayerResponseFromDOM() {
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const script of scripts) {
    const txt = script.textContent || '';
    let searchPos = 0;
    while (true) {
      const idx = txt.indexOf('ytInitialPlayerResponse', searchPos);
      if (idx === -1) break;
      searchPos = idx + 23;
      const braceStart = txt.indexOf('{', idx);
      if (braceStart === -1) continue;
      let depth = 0, i = braceStart, found = false;
      for (; i < txt.length; i++) {
        if (txt[i] === '{') depth++;
        else if (txt[i] === '}') { depth--; if (depth === 0) { found = true; break; } }
      }
      if (!found) continue;
      try {
        const parsed = JSON.parse(txt.slice(braceStart, i + 1));
        if (getTrackList(parsed)) return parsed;
      } catch (e) { /* keep searching */ }
    }
  }
  return null;
}

/** Ask background to fetch the watch page and extract the player response */
function fetchPlayerResponseViaBackground(videoId) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'FETCH_TRANSCRIPT_FALLBACK', videoId }, (res) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(res?.success ? res : null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/** Fetch a caption track URL and parse it. Tries content-script fetch first, falls back to background. */
async function fetchAndParseCaptionUrl(url) {
  // Try direct fetch first (content scripts share cookies with the page origin)
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (res.ok) {
      const text = await res.text();
      return parseTimedTextXml(text);
    }
  } catch (e) { /* fall through */ }

  // Background service-worker fetch (bypasses CORS/CSP)
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'PAGE_FETCH', url }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) return resolve(null);
        resolve(parseTimedTextXml(res.text));
      });
    } catch (e) {
      resolve(null);
    }
  });
}

// ─── Strategy A: DOM scrape ──────────────────────────────────────────────────
async function strategyA_DOM(videoId) {
  const player = extractPlayerResponseFromDOM();
  if (!player) return null;
  const tracks = getTrackList(player);
  if (!tracks || tracks.length === 0) return null;

  // Prefer English; if not found try any English variant, then any track
  const preferred =
    tracks.find(t => t.languageCode === 'en') ||
    tracks.find(t => t.languageCode?.startsWith('en')) ||
    tracks[0];

  if (!preferred?.baseUrl) return null;
  return fetchAndParseCaptionUrl(preferred.baseUrl);
}

// ─── Strategy B: Background page fetch ──────────────────────────────────────
async function strategyB_background(videoId) {
  const res = await fetchPlayerResponseViaBackground(videoId);
  if (!res) return null;

  // Background may return transcript directly if it already parsed it
  if (res.transcript && res.transcript.length > 30) return res.transcript;

  // It may also return a captionTrackBaseUrl
  if (res.captionTrackBaseUrl) {
    return fetchAndParseCaptionUrl(res.captionTrackBaseUrl);
  }
  return null;
}

// ─── Strategy C: YouTube Timedtext API ──────────────────────────────────────
// YouTube exposes auto-generated captions at a stable REST endpoint.
// This does NOT require ytInitialPlayerResponse at all.
async function strategyC_timedtextApi(videoId) {
  // YouTube's timedtext API supports these lang codes for auto-generated captions
  // We first request with lang=en, and if that fails we request without a lang
  // to get whatever the default/auto language is.
  const baseParams = `v=${videoId}&fmt=json3&xorb=2&xobt=3&xovt=3`;
  const candidates = [
    `https://www.youtube.com/api/timedtext?${baseParams}&lang=en&name=`,
    `https://www.youtube.com/api/timedtext?${baseParams}&asr_langs=en&asrvc=1&lang=en`,
    `https://www.youtube.com/api/timedtext?${baseParams}&lang=en`,
    `https://www.youtube.com/api/timedtext?${baseParams}&kind=asr&lang=en`,
    `https://www.youtube.com/api/timedtext?${baseParams}`, // No lang → default
  ];

  for (const url of candidates) {
    const text = await fetchAndParseCaptionUrl(url);
    if (text && text.length > 30) return text;

    // Also try JSON3 format (newer YouTube endpoint)
    try {
      let rawText = null;
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.ok) rawText = await r.text();
      } catch (e) {
        rawText = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'PAGE_FETCH', url }, (res) => {
            if (chrome.runtime.lastError || !res?.ok) return resolve(null);
            resolve(res.text);
          });
        });
      }
      if (!rawText) continue;

      // Try JSON3 parse
      try {
        const json = JSON.parse(rawText);
        const events = json?.events || [];
        const pieces = events
          .filter(e => e.segs)
          .flatMap(e => e.segs.map(s => s.utf8 || ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (pieces.length > 30) return pieces;
      } catch (e) { /* not JSON, was XML — already tried above */ }
    } catch (e) { /* continue */ }
  }
  return null;
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Wraps a strategy so it REJECTS if the result is null/empty.
 * This is needed because Promise.any() only resolves with the first
 * *fulfilled* promise — but if we return null, that's still "fulfilled"
 * and Promise.any() picks up a null immediately instead of waiting for
 * a real result. By throwing when null, we force Promise.any() to wait
 * for the next strategy to try.
 */
function mustFindTranscript(strategyPromise) {
  return strategyPromise.then(result => {
    if (!result || result.length < 30) throw new Error('no transcript');
    return result;
  });
}

async function scrapeAll() {
  const url = location.href;
  const genre = scrapeCategory();
  const channel = scrapeChannel();

  const videoId = extractVideoId(url);
  if (!videoId) return { url, genre, channel, transcript: null };

  // Race all three strategies in parallel.
  // mustFindTranscript converts null/empty results to rejections so
  // Promise.any() only resolves when a strategy actually finds text.
  const racePromise = Promise.any([
    mustFindTranscript(strategyA_DOM(videoId)),
    mustFindTranscript(strategyB_background(videoId)),
    mustFindTranscript(strategyC_timedtextApi(videoId)),
  ]).catch(() => null); // All three failed → return null

  // Hard timeout ensures the popup spinner never hangs
  const timeoutPromise = new Promise(resolve =>
    setTimeout(() => resolve(null), TRANSCRIPT_TIMEOUT_MS)
  );

  const transcript = await Promise.race([racePromise, timeoutPromise]);

  return { url, genre, channel, transcript: transcript || null };
}

async function sendScrapeResult() {
  const url = location.href;
  if (!/\/watch/.test(location.pathname) && !/\/shorts\//.test(location.pathname)) return;
  const result = await scrapeAll();
  if (!result.genre && !result.channel && !result.transcript) return;
  try {
    chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...result });
  } catch (e) {}
}

// ─── SCRAPE_NOW handler (popup Save button) ──────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SCRAPE_NOW') {
    (async () => {
      const result = await scrapeAll();

      // Cache in background regardless of result
      try {
        chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...result });
      } catch (e) {}

      sendResponse(result);
    })();
    return true; // keep message channel open for async response
  }
});

// Initial load
sendScrapeResult();

// YouTube SPA navigation
document.addEventListener('yt-navigate-finish', () => {
  setTimeout(sendScrapeResult, 800);
});
