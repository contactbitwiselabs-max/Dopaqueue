// DopaQueue background service worker.
// Owns the daily Dopamine Budget: the only place that decrements
// budgetMinutesUsed. Popup only reads game state and appends to the
// queue, so there's a single writer for the time-based decay logic.

import { supabaseClient } from '../shared/supabase.js';
import { isMindlessScrollUrl, isScrollTimerUrl, STORAGE_KEYS, todayLocalDateString } from '../shared/constants.js';
import {
  initStorage,
  checkDailyReset,
  getGameState,
  updateGameState,
  cacheScrapeResult,
  getScrapeResult,
  getUrlChannel,
  isWhitelistedChannel,
  addToQueue,
  ensureChannelSaved,
  getQueue,
} from '../shared/storage.js';

const BUDGET_TICK_ALARM = 'budgetTick';

const BADGE_COLORS = {
  thriving: '#22c55e',
  okay: '#f59e0b',
  wilting: '#ef4444',
  dead: '#7c8499',
};

async function ensureBudgetAlarm() {
  const existing = await chrome.alarms.get(BUDGET_TICK_ALARM);
  if (!existing) {
    chrome.alarms.create(BUDGET_TICK_ALARM, { periodInMinutes: 1 });
  }
}

async function refreshBadge() {
  await initStorage();
  const game = getGameState();
  const remaining = Math.max(0, game.budgetMinutesTotal - game.budgetMinutesUsed);
  chrome.action.setBadgeText({ text: String(remaining) });
  chrome.action.setBadgeBackgroundColor({
    color: BADGE_COLORS[game.plant] || BADGE_COLORS.dead,
  });
}

// Gives immediate visual feedback the moment the user lands on a
// mindless-scroll surface, ahead of the next budget tick.
async function handleTabChange(tab) {
  if (!tab || !tab.active) return;
  if (isMindlessScrollUrl(tab.url)) {
    chrome.action.setTitle({
      title: 'DopaQueue — mindless scroll detected, budget is ticking down',
    });
  } else {
    chrome.action.setTitle({ title: 'DopaQueue' });
  }
  await refreshBadge();
}

chrome.runtime.onInstalled.addListener(async () => {
  ensureBudgetAlarm();
  await refreshBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  ensureBudgetAlarm();
  await refreshBadge();
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  await handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    await handleTabChange(tab);
    if (changeInfo.url) {
      await handleTimerOnTabChange(tabId, changeInfo.url);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await finaliseTimerSession(tabId);
});

async function getActiveFocusedTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

// ─── Scroll Timer Session Lifecycle ──────────────────────────────────────────

function timerKey(tabId) {
  return `activeTimer_${tabId}`;
}

async function getActiveSession(tabId) {
  const key = timerKey(tabId);
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

async function handleTimerOnTabChange(tabId, url) {
  const isTimer = isScrollTimerUrl(url);
  const existing = await getActiveSession(tabId);

  if (isTimer && !existing) {
    // Create a new session
    const pageType = /youtube\.com\/shorts/i.test(url) ? 'shorts' : 'reels';
    const session = {
      startTime: Date.now(),
      accumulatedTime: 0,
      scrollCount: 1,
      pageType,
      date: todayLocalDateString(),
    };
    await chrome.storage.local.set({ [timerKey(tabId)]: session });
    console.info('DopaQueue: scroll timer session started', { tabId, pageType });
  } else if (!isTimer && existing) {
    // User navigated away — finalise the session
    await finaliseTimerSession(tabId, existing);
  }
}

async function finaliseTimerSession(tabId, session = null) {
  const key = timerKey(tabId);
  const s = session || await getActiveSession(tabId);
  if (!s) return;

  // Read latest accumulatedTime written by content script (may be fresher)
  const freshData = await chrome.storage.local.get(key);
  const fresh = freshData[key] || s;

  const endTime = Date.now();
  const duration = (fresh.accumulatedTime || 0) + (endTime - (fresh.startTime || s.startTime));

  if (duration < 1000) {
    // Ignore sub-second sessions (e.g. accidental clicks)
    await chrome.storage.local.remove(key);
    return;
  }

  const historyEntry = {
    startTime: s.startTime,
    endTime,
    duration,
    scrollCount: fresh.scrollCount || s.scrollCount || 1,
    pageType: s.pageType,
    date: s.date || todayLocalDateString(),
  };

  const existing = await chrome.storage.local.get(STORAGE_KEYS.TIMER_HISTORY);
  const history = existing[STORAGE_KEYS.TIMER_HISTORY] || [];
  history.push(historyEntry);
  // Keep last 200 sessions (~2-3 months of daily use)
  const trimmed = history.slice(-200);
  await chrome.storage.local.set({ [STORAGE_KEYS.TIMER_HISTORY]: trimmed });
  await chrome.storage.local.remove(key);

  console.info('DopaQueue: scroll timer session finalised', { tabId, durationMs: duration, pageType: s.pageType });
}

async function notifyGardenWilted() {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('src/icons/icon128.png'),
    title: 'DopaQueue',
    message: 'Your garden is wilting 🥀 Watch a saved video to restore it.',
    priority: 1,
  });
}

async function budgetTick() {
  await initStorage();
  // A long-lived service worker can cross midnight without re-hydrating
  // storage, so re-check the daily reset on every tick rather than only
  // at initStorage() time.
  checkDailyReset();
  const tab = await getActiveFocusedTab();
  const inMindlessScroll = isMindlessScrollUrl(tab && tab.url);

  const scrape = tab && tab.url ? getScrapeResult(tab.url) : null;
  // Prefer the eviction-proof url->channel map; fall back to the scrape
  // cache. This keeps the whitelist honoured even after the transcript
  // cache has trimmed this URL out.
  const channel = (tab && tab.url ? getUrlChannel(tab.url) : null) || (scrape && scrape.channel) || null;
  const isWhitelisted = isWhitelistedChannel(channel);

  const game = getGameState();
  if (!inMindlessScroll || isWhitelisted) {
    await refreshBadge();
    return;
  }

  const wasAtZero = game.budgetMinutesUsed >= game.budgetMinutesTotal;
  const budgetMinutesUsed = Math.min(
    game.budgetMinutesTotal,
    game.budgetMinutesUsed + 1
  );

  const updated = updateGameState({ budgetMinutesUsed });

  const nowAtZero = updated.budgetMinutesUsed >= updated.budgetMinutesTotal;
  if (nowAtZero && !wasAtZero && !updated.notifiedZeroToday) {
    await notifyGardenWilted();
    updateGameState({ notifiedZeroToday: true });
  }

  await refreshBadge();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BUDGET_TICK_ALARM) {
    budgetTick().catch((err) => {
      console.error('DopaQueue: budgetTick failed', err);
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_TIMER_STATE') {
    const tabId = sender?.tab?.id || null;
    const key = tabId ? timerKey(tabId) : null;
    if (!key) { sendResponse({ tabId: null, activeSession: null, todayTotal: 0 }); return false; }

    chrome.storage.local.get([key, STORAGE_KEYS.TIMER_HISTORY]).then((data) => {
      const activeSession = data[key] || null;
      const history = data[STORAGE_KEYS.TIMER_HISTORY] || [];
      const today = todayLocalDateString();
      const todayTotal = history
        .filter(h => h.date === today)
        .reduce((sum, h) => sum + (h.duration || 0), 0);
      sendResponse({ tabId, activeSession, todayTotal });
    });
    return true; // async
  }

  // GET_POPUP_TIMER_STATE: called from the popup (no sender.tab.id).
  // The popup supplies the active tab's ID explicitly.
  if (message?.type === 'GET_POPUP_TIMER_STATE') {
    const tabId = message.tabId;
    const key = tabId ? timerKey(tabId) : null;
    if (!key) { sendResponse({ tabId: null, activeSession: null, todayTotal: 0 }); return false; }

    chrome.storage.local.get([key, STORAGE_KEYS.TIMER_HISTORY]).then((data) => {
      const activeSession = data[key] || null;
      const history = data[STORAGE_KEYS.TIMER_HISTORY] || [];
      const today = todayLocalDateString();
      const todayTotal = history
        .filter(h => h.date === today)
        .reduce((sum, h) => sum + (h.duration || 0), 0);
      sendResponse({ tabId, activeSession, todayTotal });
    });
    return true; // async
  }

  if (message?.type === 'GENRE_SCRAPED') {
    initStorage().then(() => {
      cacheScrapeResult(message.url, {
        genre: message.genre || null,
        channel: message.channel || null,
        transcript: message.transcript || null,
      });
      const authorOrChan = message.channel || message.author;
      if (authorOrChan && message.url) {
        let platform = 'YouTube';
        if (message.url.includes('instagram.com')) platform = 'Instagram';
        else if (message.url.includes('tiktok.com')) platform = 'TikTok';
        else if (message.url.includes('x.com') || message.url.includes('twitter.com')) platform = 'X / Twitter';
        else if (message.url.includes('linkedin.com')) platform = 'LinkedIn';
        ensureChannelSaved(authorOrChan, '', platform);
      }
      console.info('DopaQueue: GENRE_SCRAPED', {
        url: message.url,
        transcriptLength: message.transcript ? message.transcript.length : 0,
        genre: message.genre,
        channel: message.channel,
      });
      sendResponse({ ok: true });
    });
    return true; // keep the message channel open for the async response
  }

  if (message?.type === 'SCRAPE_ATTEMPT') {
    // Lightweight logging from content scripts so we can trace failures
    try {
      console.debug('DopaQueue: SCRAPE_ATTEMPT', {
        url: message.url,
        attempt: message.attempt,
        maxAttempts: message.maxAttempts,
        success: message.success,
        hasTranscript: message.hasTranscript,
        transcriptLength: message.transcriptLength,
        reason: message.reason,
        timestamp: new Date(message.timestamp).toISOString(),
      });
      // Store attempt in scrape cache metadata
      initStorage().then(() => {
        const cache = getScrapeResult(message.url) || {};
        cache.lastAttempts = cache.lastAttempts || [];
        cache.lastAttempts.push({
          attempt: message.attempt,
          success: message.success,
          reason: message.reason,
          hasTranscript: message.hasTranscript,
          timestamp: message.timestamp,
        });
        // Keep only last 10 attempts
        cache.lastAttempts = cache.lastAttempts.slice(-10);
        cacheScrapeResult(message.url, cache);
      });
    } catch (e) {}
    return false;
  }

  if (message?.type === 'FETCH_TRANSCRIPT_FALLBACK') {
    fetchTranscriptFallback(message.videoId)
      .then((data) => {
        sendResponse({ success: true, ...data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message || String(err) });
      });
    return true; // keep channel open for async response
  }

  if (message?.type === 'GET_SCRAPE') {
    initStorage().then(() => {
      sendResponse(getScrapeResult(message.url));
    });
    return true;
  }

  if (message?.type === 'PAGE_FETCH') {
    // CORS-safe fetch on behalf of the content script (e.g. caption
    // tracks). The service worker isn't subject to the page's CORS/CSP
    // for hosts declared in host_permissions.
    fetch(message.url, { credentials: 'omit' })
      .then((res) => res.text())
      .then((text) => sendResponse({ ok: true, text }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === 'FETCH_BASE64_IMAGE') {
    fetchBase64Image(message.url)
      .then((dataUrl) => sendResponse({ ok: !!dataUrl, dataUrl }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === 'CHECK_SAVED_URL') {
    initStorage().then(() => {
      const queue = getQueue();
      const saved = queue.some(i => !i.deleted && i.url === message.url);
      sendResponse({ saved });
    });
    return true; // async
  }

  if (message?.type === 'SAVE_INSTAGRAM_ITEM') {
    initStorage().then(() => {
      const entry = {
        id: crypto.randomUUID(),
        url: message.url,
        title: message.title || 'Instagram Post',
        thumbnail: message.thumbnail || null,
        author: message.author || null,
        contentType: message.contentType || 'reel',
        type: 'video',
        savedAt: Date.now(),
        watched: false,
      };
      addToQueue(entry);
      cacheScrapeResult(message.url, {
        genre: message.contentType || 'Instagram',
        channel: message.author || null,
      });
      if (message.author) {
        ensureChannelSaved(message.author, '', message.platform || 'Instagram');
      }
      sendResponse({ ok: true, entry });
    });
    return true;
  }

  if (message?.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    return false;
  }

  return false;
});

async function fetchBase64Image(url) {
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.byteLength > 2500000) return null;
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error('DopaQueue background: fetchBase64Image error', err);
    return null;
  }
}

/**
 * Parse YouTube timedtext response (JSON3 or XML).
 * IMPORTANT: Service workers do NOT have DOMParser, so XML is parsed
 * with regex. This matches the approach used by youtube-transcript-api.
 */
function parseTimedText(rawText) {
  if (!rawText || rawText.length < 10) return null;

  // 1. Try JSON3 format first (preferred — structured, no XML ambiguity)
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
  } catch (e) { /* not JSON — try XML */ }

  // 2. Regex-based XML parsing (service workers have no DOMParser)
  try {
    const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/gi;
    const segments = [];
    let match;
    while ((match = textRegex.exec(rawText)) !== null) {
      let text = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/<[^>]+>/g, '') // strip nested tags like <font>
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) segments.push(text);
    }
    const joined = segments.join(' ').trim();
    if (joined.length > 20) return joined;
  } catch (e) { /* parsing failed */ }

  return null;
}

/**
 * Appends fmt=json3 to a caption baseUrl if not already present,
 * so we get the JSON format which is reliably parseable in all contexts.
 */
function ensureJson3Fmt(url) {
  if (!url) return url;
  if (url.includes('fmt=')) return url; // already has a format
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + 'fmt=json3';
}

async function fetchTranscriptFallback(videoId) {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const html = await res.text();

    // Scrape category
    let genre = null;
    const genreMatch = html.match(/<meta itemprop="genre" content="([^"]+)">/);
    if (genreMatch) {
      genre = genreMatch[1];
    } else {
      const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)">/);
      if (keywordsMatch) genre = keywordsMatch[1].split(',')[0]?.trim();
    }

    // Scrape channel
    let channel = null;
    const channelMatch = html.match(/<link itemprop="name" content="([^"]+)">/);
    if (channelMatch) channel = channelMatch[1];

    // Find ytInitialPlayerResponse with caption tracks (balanced-brace scan)
    let player = null;
    let searchIdx = 0;
    while (true) {
      const idx = html.indexOf('ytInitialPlayerResponse', searchIdx);
      if (idx === -1) break;
      searchIdx = idx + 23;
      const braceStart = html.indexOf('{', idx);
      if (braceStart === -1) continue;
      let depth = 0, i = braceStart, found = false;
      for (; i < html.length; i++) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') { depth--; if (depth === 0) { found = true; break; } }
      }
      if (!found) continue;
      try {
        const parsed = JSON.parse(html.slice(braceStart, i + 1));
        if (parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
          player = parsed;
          break;
        }
      } catch (e) { /* keep scanning */ }
    }

    let transcript = null;
    let captionTrackBaseUrl = null;

    if (player) {
      const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      console.info('DopaQueue background: found', tracks.length, 'caption tracks for', videoId,
        tracks.map(t => `${t.languageCode}${t.kind === 'asr' ? '(auto)' : ''}`));

      // Order: en → en-XX → any ASR → first available
      const ordered = [
        tracks.find(t => t.languageCode === 'en' && t.kind === 'asr'),
        tracks.find(t => t.languageCode === 'en'),
        tracks.find(t => t.languageCode?.startsWith('en') && t.kind === 'asr'),
        tracks.find(t => t.languageCode?.startsWith('en')),
        tracks.find(t => t.kind === 'asr'),
        tracks[0],
      ].filter(Boolean);

      // Deduplicate (same track may match multiple filters)
      const seen = new Set();
      const unique = ordered.filter(t => {
        if (seen.has(t.baseUrl)) return false;
        seen.add(t.baseUrl);
        return true;
      });

      for (const track of unique) {
        if (!track?.baseUrl) continue;
        const jsonUrl = ensureJson3Fmt(track.baseUrl);
        captionTrackBaseUrl = jsonUrl;
        try {
          const captionRes = await fetch(jsonUrl);
          if (captionRes.ok) {
            const text = await captionRes.text();
            transcript = parseTimedText(text);
            if (transcript) {
              console.info('DopaQueue background: transcript found via', track.languageCode, 'length:', transcript.length);
              break;
            }
          }
        } catch (e) { /* try next track */ }

        // Also try XML format if JSON didn't work
        try {
          const captionRes = await fetch(track.baseUrl);
          if (captionRes.ok) {
            const text = await captionRes.text();
            transcript = parseTimedText(text);
            if (transcript) {
              console.info('DopaQueue background: transcript found via XML', track.languageCode);
              break;
            }
          }
        } catch (e) { /* try next track */ }
      }
    }

    // Last resort: direct timedtext API
    if (!transcript) {
      const apiUrls = [
        `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3&lang=en&kind=asr`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3&lang=en`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=json3`,
      ];
      for (const url of apiUrls) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const text = await r.text();
            transcript = parseTimedText(text);
            if (transcript) break;
          }
        } catch (e) { /* try next */ }
      }
    }

    console.info('DopaQueue background: fetchTranscriptFallback result for', videoId,
      '→ transcript:', transcript ? `${transcript.length} chars` : 'null',
      '→ genre:', genre, '→ channel:', channel);

    return { success: true, genre, channel, transcript, captionTrackBaseUrl };
  } catch (err) {
    console.error('DopaQueue background: fetchTranscriptFallback error', err);
    return { success: false, error: err.message || String(err) };
  }
}

// Cover the edge case where the service worker was asleep and this
// module just spun back up in response to an event.
ensureBudgetAlarm();
refreshBadge();
