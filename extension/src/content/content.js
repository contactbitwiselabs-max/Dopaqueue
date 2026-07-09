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

async function getPermanentThumbnail(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:')) return imageUrl;
  try {
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'FETCH_BASE64_IMAGE', url: imageUrl }, (r) => {
        if (chrome.runtime.lastError || !r?.ok) return resolve(null);
        resolve(r.dataUrl);
      });
    });
    if (!res) return imageUrl;

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 320;
          const scale = Math.min(1, maxW / (img.width || 320));
          const w = Math.round((img.width || 320) * scale);
          const h = Math.round((img.height || 320) * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.72);
          resolve(compressed);
        } catch (e) {
          resolve(res);
        }
      };
      img.onerror = () => resolve(res);
      img.src = res;
    });
  } catch (e) {
    return imageUrl;
  }
}

async function universalScrapeAll(targetUrl) {
  const url = targetUrl || location.href;
  const host = location.hostname.toLowerCase();

  let platform = 'Social Media';
  if (host.includes('instagram.com')) platform = 'Instagram';
  else if (host.includes('tiktok.com')) platform = 'TikTok';
  else if (host.includes('twitter.com') || host.includes('x.com')) platform = 'X / Twitter';
  else if (host.includes('linkedin.com')) platform = 'LinkedIn';
  else if (host.includes('reddit.com')) platform = 'Reddit';
  else if (host.includes('facebook.com')) platform = 'Facebook';
  else if (host.includes('youtube.com')) platform = 'YouTube';

  const isReel = /\/(reel|reels|shorts|video)\//i.test(url);
  const contentType = isReel ? 'reel' : 'post';

  let rawImgUrl = null;
  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg?.content) rawImgUrl = ogImg.content;
  if (!rawImgUrl) {
    const videoPoster = document.querySelector('video[poster]');
    if (videoPoster?.poster) rawImgUrl = videoPoster.poster;
  }
  if (!rawImgUrl) {
    const twitterImg = document.querySelector('meta[name="twitter:image"]');
    if (twitterImg?.content) rawImgUrl = twitterImg.content;
  }
  if (!rawImgUrl) {
    const firstImg = document.querySelector('article img[src*="http"], main img[src*="http"]');
    if (firstImg?.src) rawImgUrl = firstImg.src;
  }

  const thumbnail = await getPermanentThumbnail(rawImgUrl);

  let title = document.title || `${platform} Item`;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle?.content) title = ogTitle.content;
  else {
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle?.content) title = twitterTitle.content;
  }

  let author = null;
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc?.content) {
    const match = ogDesc.content.match(/(@[\w.-]+)/);
    if (match) author = match[1];
  }
  if (!author) {
    const twitterCreator = document.querySelector('meta[name="twitter:creator"]');
    if (twitterCreator?.content) author = twitterCreator.content;
  }
  if (!author) {
    const authorLink = document.querySelector('header a[href*="/"]');
    if (authorLink) {
      const href = authorLink.getAttribute('href') || '';
      const handle = href.replace(/^\/|\/$/g, '');
      if (handle && !['explore', 'reels', 'home', 'status'].includes(handle.toLowerCase())) {
        author = handle.startsWith('@') ? handle : '@' + handle;
      }
    }
  }

  let authorUrl = null;
  if (author) {
    const cleanHandle = author.replace(/^@/, '');
    if (platform === 'Instagram') authorUrl = `https://www.instagram.com/${cleanHandle}/`;
    else if (platform === 'TikTok') authorUrl = `https://www.tiktok.com/@${cleanHandle}`;
    else if (platform === 'X / Twitter') authorUrl = `https://x.com/${cleanHandle}`;
    else if (platform === 'YouTube') authorUrl = `https://www.youtube.com/@${cleanHandle}`;
    else authorUrl = location.origin;
  }

  return {
    url,
    title,
    thumbnail,
    author,
    authorUrl,
    genre: contentType,
    channel: author,
    contentType,
    platform,
    transcript: null
  };
}

async function scrapeAll() {
  if (!location.hostname.includes('youtube.com')) {
    return await universalScrapeAll();
  }

  const url = location.href;
  const genre = scrapeCategory();
  const channel = scrapeChannel();

  const videoId = extractVideoId(url);
  if (!videoId) return { url, genre, channel, transcript: null };

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
  if (location.hostname.includes('youtube.com') && !/\/watch/.test(location.pathname) && !/\/shorts\//.test(location.pathname)) return;
  const result = await scrapeAll();
  if (!result.genre && !result.channel && !result.transcript && !result.thumbnail) return;
  try {
    chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...result });
  } catch (e) {}
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SCRAPE_NOW') {
    (async () => {
      const result = await scrapeAll();
      try {
        chrome.runtime.sendMessage({ type: 'GENRE_SCRAPED', ...result });
      } catch (e) {}
      sendResponse(result);
    })();
    return true;
  }
});

function initInstagramButtons() {
  if (!location.hostname.includes('instagram.com')) return;

  // Inject keyframes for SVG micro-animation
  if (!document.getElementById('dq-ig-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'dq-ig-styles';
    styleSheet.innerHTML = `
      @keyframes dqIconBounce {
        0% { transform: scale(1); }
        35% { transform: scale(1.4) rotate(-12deg); }
        70% { transform: scale(0.85); }
        100% { transform: scale(1); }
      }
      .dq-animate-bounce {
        animation: dqIconBounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
    `;
    document.head.appendChild(styleSheet);
  }

  const observer = new MutationObserver(() => {
    // 1. Animated SVG Icon directly ABOVE Like button on Reels / Posts
    const likeSvgs = document.querySelectorAll('svg[aria-label="Like"], svg[aria-label="Unlike"]');
    likeSvgs.forEach((likeSvg) => {
      const actionItem = likeSvg.closest('button') || likeSvg.closest('div[role="button"]') || likeSvg.parentElement;
      if (!actionItem || !actionItem.parentElement) return;
      const parentContainer = actionItem.parentElement;

      if (parentContainer.querySelector('.dq-ig-above-like')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'dq-ig-above-like';
      wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 18px;
        cursor: pointer;
        user-select: none;
        z-index: 10;
      `;

      const iconBox = document.createElement('div');
      iconBox.className = 'dq-icon-box';
      iconBox.title = 'Save to DopaQueue Library';
      iconBox.style.cssText = `
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(132, 204, 22, 0.15);
        border: 1.5px solid rgba(132, 204, 22, 0.45);
        transition: all 0.25s ease;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      `;

      iconBox.innerHTML = `
        <svg class="dq-svg-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 3H7C5.9 3 5 3.9 5 5V21L12 18L19 21V5C19 3.9 18.1 3 17 3ZM17 18L12 15.82L7 18V5H17V18Z" fill="#84cc16"/>
        </svg>
      `;

      const label = document.createElement('span');
      label.className = 'dq-save-label';
      label.textContent = 'Save';
      label.style.cssText = `
        font-size: 11px;
        font-weight: 700;
        color: #a3e635;
        margin-top: 5px;
        letter-spacing: 0.3px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;

      wrapper.appendChild(iconBox);
      wrapper.appendChild(label);

      let isSaved = false;

      wrapper.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Play bounce micro-animation
        iconBox.classList.remove('dq-animate-bounce');
        void iconBox.offsetWidth;
        iconBox.classList.add('dq-animate-bounce');

        if (!isSaved) {
          label.textContent = 'Saving...';
          const scraped = await universalScrapeAll(location.href);
          chrome.runtime.sendMessage({
            type: 'SAVE_INSTAGRAM_ITEM',
            ...scraped,
          }, () => {
            isSaved = true;
            iconBox.style.background = 'rgba(34, 197, 94, 0.28)';
            iconBox.style.borderColor = '#4ade80';
            iconBox.innerHTML = `
              <svg class="dq-svg-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="#4ade80"/>
              </svg>
            `;
            label.textContent = 'Saved';
            label.style.color = '#4ade80';
          });
        }
      });

      parentContainer.insertBefore(wrapper, actionItem);
    });

    // 2. Modal / Dialog Share Sheet button
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    dialogs.forEach((dialog) => {
      const textContent = dialog.textContent || '';
      const isShareDialog = textContent.includes('Share') || textContent.includes('Copy link') || textContent.includes('Share to');
      if (!isShareDialog) return;
      if (dialog.querySelector('#dq-instagram-share-btn')) return;

      let postUrl = location.href;
      const inputEl = dialog.querySelector('input');
      if (inputEl?.value && /instagram\.com\/(p|reel|reels)\//i.test(inputEl.value)) {
        postUrl = inputEl.value;
      }

      const btnContainer = document.createElement('div');
      btnContainer.id = 'dq-instagram-share-btn';
      btnContainer.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        margin: 12px 16px;
        background: rgba(132, 204, 22, 0.12);
        border: 1px solid rgba(132, 204, 22, 0.35);
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #84cc16;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      btnContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">🌿</span>
          <div>
            <div style="color: #f4f4f5; font-weight: 600; font-size: 14px;">Save to DopaQueue</div>
            <div style="color: #a1a1aa; font-weight: 400; font-size: 12px;">Save post & permanent thumbnail intentionally</div>
          </div>
        </div>
        <span style="font-size: 11px; background: #84cc16; color: #09090b; padding: 4px 10px; border-radius: 8px; font-weight: 700; text-transform: uppercase;">Save</span>
      `;

      btnContainer.addEventListener('click', async (e) => {
        e.stopPropagation();
        btnContainer.style.opacity = '0.7';
        btnContainer.style.pointerEvents = 'none';
        btnContainer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; color: #f4f4f5;">
            <span>⏳ Saving with permanent thumbnail...</span>
          </div>
        `;

        const scraped = await universalScrapeAll(postUrl);

        chrome.runtime.sendMessage({
          type: 'SAVE_INSTAGRAM_ITEM',
          ...scraped,
        }, () => {
          btnContainer.style.background = 'rgba(34, 197, 94, 0.18)';
          btnContainer.style.borderColor = 'rgba(34, 197, 94, 0.5)';
          btnContainer.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; color: #4ade80;">
              <span style="font-size: 18px;">✅</span>
              <span style="font-weight: 700;">Saved to DopaQueue Library!</span>
            </div>
          `;
        });
      });

      const contentArea = dialog.querySelector('div[class*="content"]') || dialog.firstElementChild;
      if (contentArea) {
        contentArea.appendChild(btnContainer);
      } else {
        dialog.appendChild(btnContainer);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Initial load
sendScrapeResult();
checkMindfulFlowBreaker();
initInstagramButtons();

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
