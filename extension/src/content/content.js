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

const TRANSCRIPT_TIMEOUT_MS = 20000; // Hard cap — popup spinner stops after this

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

// ─── Strategy D: YouTube live player API via MAIN WORLD bridge ────────────────
// Uses main_world.js (injected into MAIN world) to get live captionTracks from
// ytInitialPlayerResponse or ytd-watch-flexy.__data.playerResponse, bypassing
// isolated world restrictions.
async function strategyD_livePlayerAPI(videoId) {
  try {
    const tracksFromMain = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 3000);

      function handler(event) {
        if (event.source !== window || !event.data) return;
        if (event.data.type === 'DOPAQUEUE_RES_MAIN_PLAYER' && event.data.videoId === videoId) {
          clearTimeout(timer);
          window.removeEventListener('message', handler);
          resolve(event.data.tracks || null);
        }
      }
      window.addEventListener('message', handler);
      window.postMessage({ type: 'DOPAQUEUE_REQ_MAIN_PLAYER', videoId }, '*');
    });

    if (tracksFromMain && tracksFromMain.length > 0) {
      const preferred = pickBestTrack(tracksFromMain);
      if (preferred?.baseUrl) {
        const text = await fetchAndParseCaptionUrl(ensureJson3(preferred.baseUrl));
        if (text && text.length > 20) return text;
      }
    }
  } catch (e) {
    // fall through
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
checkMindfulFlowBreaker();

// YouTube SPA navigation
document.addEventListener('yt-navigate-finish', () => {
  setTimeout(sendScrapeResult, 800);
  setTimeout(checkMindfulFlowBreaker, 600);
});

// ─── Enterprise Mindful Flow Breaker (Dopamine Circuit Breaker) ──────────────
// Diverts users from mindless short-form scroll loops (Shorts/Reels) by
// interrupting auto-pilot scrolling and redirecting them to their intentional library.

function checkMindfulFlowBreaker() {
  const isShortForm = /\/shorts\//.test(location.pathname) || /\/(reels|explore)\//.test(location.pathname);
  const passExpiry = Number(sessionStorage.getItem('dopaqueue_mindful_pass') || '0');
  const existingOverlay = document.getElementById('dopaqueue-flow-breaker');

  if (!isShortForm || (passExpiry && Date.now() < passExpiry)) {
    if (existingOverlay) existingOverlay.remove();
    return;
  }

  if (existingOverlay) return; // Already visible

  const overlay = document.createElement('div');
  overlay.id = 'dopaqueue-flow-breaker';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 2147483647;
    background: rgba(9, 9, 11, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  overlay.innerHTML = `
    <div style="max-width: 440px; width: 90%; background: #18181b; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);">
      <div style="width: 48px; height: 48px; background: rgba(132, 204, 22, 0.12); border: 1px solid rgba(132, 204, 22, 0.3); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px;">
        🌿
      </div>
      <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 10px; color: #f4f4f5;">Mindful Check-In</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 24px;">
        Short-form video feeds are engineered for mindless loop scrolling. Break the loop and focus on content you intentionally saved.
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="dq-open-library" style="width: 100%; padding: 12px 18px; border-radius: 12px; border: none; background: #84cc16; color: #09090b; font-weight: 600; font-size: 14px; cursor: pointer; transition: transform 0.15s, background 0.15s;">
          Open Intentional Library
        </button>
        <button id="dq-save-exit" style="width: 100%; padding: 11px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #e4e4e7; font-weight: 500; font-size: 14px; cursor: pointer;">
          Save This Short & Leave
        </button>
      </div>
      <button id="dq-mindful-continue" style="margin-top: 20px; background: none; border: none; color: #71717a; font-size: 12px; cursor: pointer; text-decoration: underline;">
        Watch Intentionally (Unblock for 10 min)
      </button>
    </div>
  `;

  document.documentElement.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  document.getElementById('dq-open-library').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });

  document.getElementById('dq-save-exit').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SCRAPE_NOW' });
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  });

  document.getElementById('dq-mindful-continue').addEventListener('click', () => {
    sessionStorage.setItem('dopaqueue_mindful_pass', String(Date.now() + 10 * 60 * 1000));
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  });
}
