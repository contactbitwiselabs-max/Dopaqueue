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

  const preferred = pickBestTrack(tracks);
  if (!preferred?.baseUrl) return null;
  return fetchAndParseCaptionUrl(ensureJson3(preferred.baseUrl));
}

// ─── Strategy B: Background page fetch ──────────────────────────────────────
async function strategyB_background(videoId) {
  const res = await fetchPlayerResponseViaBackground(videoId);
  if (!res) return null;

  // Background returns transcript directly if it already parsed it
  if (res.transcript && res.transcript.length > 20) return res.transcript;

  // It may also return a captionTrackBaseUrl
  if (res.captionTrackBaseUrl) {
    return fetchAndParseCaptionUrl(res.captionTrackBaseUrl);
  }
  return null;
}

// ─── Strategy C: YouTube Timedtext API ──────────────────────────────────────
async function strategyC_timedtextApi(videoId) {
  const candidates = [
    `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3&lang=en&kind=asr`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3&lang=en`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3`,
  ];

  for (const url of candidates) {
    try {
      let rawText = null;
      // Content script fetch (has page cookies)
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.ok) rawText = await r.text();
      } catch (e) { /* fall through */ }

      // Background fetch fallback
      if (!rawText) {
        rawText = await new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage({ type: 'PAGE_FETCH', url }, (res) => {
              if (chrome.runtime.lastError || !res?.ok) return resolve(null);
              resolve(res.text);
            });
          } catch (e) { resolve(null); }
        });
      }
      if (!rawText || rawText.length < 20) continue;

      const parsed = parseTimedTextXml(rawText);
      if (parsed && parsed.length > 20) return parsed;

      // Try JSON3 parse (the fmt=json3 URLs return JSON)
      try {
        const json = JSON.parse(rawText);
        const events = json?.events || [];
        const pieces = events
          .filter(e => e.segs)
          .flatMap(e => e.segs.map(s => s.utf8 || ''))
          .join('')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (pieces.length > 20) return pieces;
      } catch (e) { /* not JSON */ }
    } catch (e) { /* continue */ }
  }
  return null;
}

// ─── Strategy D: YouTube live player API ─────────────────────────────────────
// On SPA navigations, <script> tags have STALE data from the initial load.
// But YouTube's custom elements store the CURRENT player response in their
// internal __data property. This strategy reads it directly.
async function strategyD_livePlayerAPI(videoId) {
  try {
    // Try to get the player response from YouTube's DOM elements
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    const playerResponse = watchFlexy?.__data?.playerResponse
      || watchFlexy?.playerResponse
      || watchFlexy?.data?.playerResponse;

    if (playerResponse) {
      const tracks = getTrackList(playerResponse);
      if (tracks && tracks.length > 0) {
        const preferred = pickBestTrack(tracks);
        if (preferred?.baseUrl) {
          return fetchAndParseCaptionUrl(ensureJson3(preferred.baseUrl));
        }
      }
    }

    // Alternative: try the movie_player API
    const moviePlayer = document.querySelector('#movie_player');
    if (moviePlayer && typeof moviePlayer.getPlayerResponse === 'function') {
      const resp = moviePlayer.getPlayerResponse();
      const tracks = getTrackList(resp);
      if (tracks && tracks.length > 0) {
        const preferred = pickBestTrack(tracks);
        if (preferred?.baseUrl) {
          return fetchAndParseCaptionUrl(ensureJson3(preferred.baseUrl));
        }
      }
    }
  } catch (e) {
    // These DOM APIs may not be accessible from the content script's
    // isolated world — that's expected, Strategy B handles it instead.
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickBestTrack(tracks) {
  return (
    tracks.find(t => t.languageCode === 'en' && t.kind === 'asr') ||
    tracks.find(t => t.languageCode === 'en') ||
    tracks.find(t => t.languageCode?.startsWith('en') && t.kind === 'asr') ||
    tracks.find(t => t.languageCode?.startsWith('en')) ||
    tracks.find(t => t.kind === 'asr') ||
    tracks[0]
  );
}

function ensureJson3(url) {
  if (!url) return url;
  if (url.includes('fmt=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'fmt=json3';
}

// ─── Main entry point ────────────────────────────────────────────────────────

function mustFindTranscript(strategyPromise) {
  return strategyPromise.then(result => {
    if (!result || result.length < 20) throw new Error('no transcript');
    return result;
  });
}

async function scrapeAll() {
  const url = location.href;
  const genre = scrapeCategory();
  const channel = scrapeChannel();

  const videoId = extractVideoId(url);
  if (!videoId) return { url, genre, channel, transcript: null };

  // Race all four strategies. mustFindTranscript rejects on null
  // so Promise.any only resolves when a strategy actually finds text.
  const racePromise = Promise.any([
    mustFindTranscript(strategyD_livePlayerAPI(videoId)),
    mustFindTranscript(strategyA_DOM(videoId)),
    mustFindTranscript(strategyB_background(videoId)),
    mustFindTranscript(strategyC_timedtextApi(videoId)),
  ]).catch(() => null);

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
