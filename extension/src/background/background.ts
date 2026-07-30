// @ts-nocheck
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
const REVIEW_DECK_ALARM = 'reviewDeckTick';

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

  const existingReview = await chrome.alarms.get(REVIEW_DECK_ALARM);
  if (!existingReview) {
    chrome.alarms.create(REVIEW_DECK_ALARM, { periodInMinutes: 5 });
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
      title: 'DopaQueue â€” mindless scroll detected, budget is ticking down',
    });
  } else {
    chrome.action.setTitle({ title: 'DopaQueue' });
  }
  await refreshBadge();
}

chrome.runtime.onInstalled.addListener(async () => {
  ensureBudgetAlarm();
  await refreshBadge();
  setupContextMenus();
});

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'dq-save-page',
      title: '📌 Save page to DopaQueue',
      contexts: ['page', 'frame'],
    });
    chrome.contextMenus.create({
      id: 'dq-save-image',
      title: '🖼️ Save image to DopaQueue',
      contexts: ['image'],
    });
    chrome.contextMenus.create({
      id: 'dq-save-link',
      title: '🔗 Save link to DopaQueue',
      contexts: ['link'],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await initStorage();

  if (info.menuItemId === 'dq-save-page' && tab) {
    const domain = new URL(tab.url || 'https://example.com').hostname.replace(/^www\./, '');
    const entry = {
      id: crypto.randomUUID(),
      url: tab.url || '',
      title: tab.title || tab.url || 'Saved Page',
      thumbnail: tab.favIconUrl || null,
      platform: detectPlatformFromUrl(tab.url || ''),
      contentType: 'link',
      type: 'link',
      sourceDomain: domain,
      savedAt: Date.now(),
      watched: false,
    };
    addToQueue(entry);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/icons/icon48.png'),
      title: 'DopaQueue',
      message: `Page saved: "${(tab.title || '').slice(0, 50)}"`,
    });
  }

  if (info.menuItemId === 'dq-save-image' && info.srcUrl) {
    const domain = tab?.url ? new URL(tab.url).hostname.replace(/^www\./, '') : '';
    // Send message to content script to enrich with alt text / caption
    // If content script not reachable, fall back to direct save
    try {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'SAVE_IMAGE_FROM_CONTEXT', srcUrl: info.srcUrl });
      }
    } catch {
      // Direct save fallback
      const entry = {
        id: crypto.randomUUID(),
        url: info.srcUrl,
        title: 'Saved Image',
        thumbnail: info.srcUrl,
        platform: detectPlatformFromUrl(tab?.url || ''),
        contentType: 'image',
        type: 'image',
        sourceDomain: domain,
        savedAt: Date.now(),
        watched: false,
      };
      addToQueue(entry);
    }
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/icons/icon48.png'),
      title: 'DopaQueue',
      message: 'Image saved to DopaQueue!',
    });
  }

  if (info.menuItemId === 'dq-save-link' && info.linkUrl) {
    const domain = (() => { try { return new URL(info.linkUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const entry = {
      id: crypto.randomUUID(),
      url: info.linkUrl,
      title: info.selectionText || info.linkUrl.slice(0, 80),
      thumbnail: null,
      platform: detectPlatformFromUrl(info.linkUrl),
      contentType: 'link',
      type: 'link',
      sourceDomain: domain,
      savedAt: Date.now(),
      watched: false,
    };
    addToQueue(entry);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/icons/icon48.png'),
      title: 'DopaQueue',
      message: `Link saved: "${entry.title.slice(0, 50)}"`,
    });
  }
});

function detectPlatformFromUrl(url: string): string {
  if (!url) return 'web';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('x.com') || url.includes('twitter.com')) return 'x';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('linkedin.com')) return 'linkedin';
  return 'web';
}

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

// â”€â”€â”€ Scroll Timer Session Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    // User navigated away â€” finalise the session
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
    scrollTimestamps: fresh.scrollTimestamps || s.scrollTimestamps || [],
    pageType: s.pageType,
    date: s.date || todayLocalDateString(),
    hourOfDay: new Date(s.startTime).getHours(),
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
    message: 'Your garden is wilting ðŸ¥€ Watch a saved video to restore it.',
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

  const remainingMins = Math.max(0, game.budgetMinutesTotal - budgetMinutesUsed);
  const health = Math.max(0, Math.min(100, Math.round((remainingMins / (game.budgetMinutesTotal || 1)) * 100)));
  const updated = updateGameState({ budgetMinutesUsed, health });

  const nowAtZero = updated.budgetMinutesUsed >= updated.budgetMinutesTotal;
  if (nowAtZero && !wasAtZero && !updated.notifiedZeroToday) {
    await notifyGardenWilted();
    updateGameState({ notifiedZeroToday: true });
  }

  await refreshBadge();
}

async function checkReviewDeckExpirations() {
  await initStorage();
  const queue = getQueue();
  const now = Date.now();
  let updated = false;

  for (const item of queue) {
    if (item.expiryDate && item.expiryDate <= now && !item.notifiedExpiry && !item.deleted) {
      // Trigger notification
      await chrome.notifications.create(`review-${item.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('src/icons/icon128.png'),
        title: 'DopaQueue Review Reminder',
        message: `It's time to review: "${item.title}"!`,
        priority: 2,
      });

      // Update item so we don't notify again
      // We do this directly via chrome.storage.local to avoid pulling the entire queue update flow here if possible,
      // but the safest way is via updateQueueItem from storage.js, which we can import.
      // Wait, updateQueueItem isn't imported. Let's just import it at the top or update the raw object.
      // We will rely on raw storage update for simplicity since updateQueueItem might not be imported in background.
      item.notifiedExpiry = true;
      updated = true;
    }
  }

  if (updated) {
    chrome.storage.local.set({ [STORAGE_KEYS.QUEUE]: queue });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BUDGET_TICK_ALARM) {
    budgetTick().catch((err) => {
      console.error('DopaQueue: budgetTick failed', err);
    });
  } else if (alarm.name === REVIEW_DECK_ALARM) {
    checkReviewDeckExpirations().catch((err) => {
      console.error('DopaQueue: checkReviewDeckExpirations failed', err);
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
        genre: message.genre || message.contentType || null,
        channel: message.channel || message.author || null,
        transcript: message.transcript || null,
        scrapedTags: Array.isArray(message.scrapedTags) ? message.scrapedTags : undefined,
        authorImage: message.authorImage || null,
        platform: message.platform || null,
        authorUrl: message.authorUrl || null,
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
        scrapedTagsCount: message.scrapedTags?.length || 0,
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

  // ─── Unified SAVE_ITEM handler ─────────────────────────────────────────────
  // All content scripts, context menus, and popup saves flow through here.
  if (message?.type === 'SAVE_ITEM') {
    initStorage().then(async () => {
      const url = message.url;
      if (!url) { sendResponse({ ok: false, error: 'No URL' }); return; }

      const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
      const contentType = message.contentType || message.type || 'link';

      const entry = {
        id: crypto.randomUUID(),
        url,
        title: (message.title || url).slice(0, 200),
        thumbnail: message.thumbnail || null,
        author: message.author || null,
        authorUrl: message.authorUrl || null,
        platform: message.platform || detectPlatformFromUrl(url),
        contentType,
        type: contentType,
        tags: Array.isArray(message.tags) ? message.tags : [],
        note: message.note || null,
        collection: message.collection || null,
        urgency: message.urgency || null,
        sourceDomain: domain,
        altText: message.altText || null,
        wordCount: message.wordCount || null,
        blobId: message.blobId || null,
        description: message.description || null,
        fromContentScript: message.fromContentScript || false,
        savedAt: Date.now(),
        watched: false,
      };

      const saved = addToQueue(entry);

      // Cache scrape result for platforms with metadata
      if (message.platform || message.author || message.thumbnail) {
        cacheScrapeResult(url, {
          genre: contentType,
          channel: message.author || null,
          title: entry.title,
          thumbnail: message.thumbnail || null,
          author: message.author || null,
          authorUrl: message.authorUrl || null,
          scrapedTags: Array.isArray(message.tags) ? message.tags : undefined,
          platform: message.platform || null,
        });
      }

      sendResponse({ ok: true, entry: saved });
    });
    return true;
  }

  // ─── Screenshot handlers ──────────────────────────────────────────────────
  if (message?.type === 'CAPTURE_SCREENSHOT_VISIBLE') {
    (async () => {
      try {
        const tab = await getActiveFocusedTab();
        if (!tab?.windowId) { sendResponse({ ok: false, error: 'No active window' }); return; }
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 85 });
        sendResponse({ ok: true, dataUrl });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (message?.type === 'CAPTURE_SCREENSHOT_AREA') {
    (async () => {
      try {
        const tab = await getActiveFocusedTab();
        if (!tab?.id) { sendResponse({ ok: false, error: 'No active tab' }); return; }

        // Inject the overlay content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/features/screenshotCapture.js'],
        });

        sendResponse({ ok: true, status: 'overlay_injected' });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (message?.type === 'SCREENSHOT_AREA_SELECTED') {
    (async () => {
      try {
        const tab = await getActiveFocusedTab();
        if (!tab?.windowId) { sendResponse({ ok: false }); return; }
        const fullDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 90 });
        // Crop is handled client-side by the popup using OffscreenCanvas
        sendResponse({ ok: true, dataUrl: fullDataUrl, rect: message.rect });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (message?.type === 'SCREENSHOT_AREA_CANCELLED') {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'SAVE_INSTAGRAM_ITEM') {
    initStorage().then(() => {
      const entry = {
        id: crypto.randomUUID(),
        url: message.url,
        title: message.title && message.title !== 'Instagram Item' ? message.title : (message.author ? `${message.author}'s post` : 'Instagram Post'),
        thumbnail: message.thumbnail || null,
        author: message.author || null,
        authorUrl: message.authorUrl || null,
        platform: message.platform || 'Instagram',
        contentType: message.contentType || 'reel',
        type: 'video',
        savedAt: Date.now(),
        watched: false,
      };
      addToQueue(entry);
      cacheScrapeResult(message.url, {
        genre: message.contentType || 'Instagram',
        channel: message.author || null,
        title: message.title || null,
        thumbnail: message.thumbnail || null,
        author: message.author || null,
        authorUrl: message.authorUrl || null,
        authorImage: message.authorImage || null,
        scrapedTags: Array.isArray(message.scrapedTags) ? message.scrapedTags : undefined,
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

  if (message?.type === 'LOG_FLOW_BREAKER') {
    (async () => {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS.FLOW_BREAKER_LOG);
        const log = data[STORAGE_KEYS.FLOW_BREAKER_LOG] || [];
        log.push({
          timestamp: Date.now(),
          result: message.result || 'unknown',
          platform: message.platform || (sender?.tab?.url?.includes('instagram') ? 'reels' : 'shorts'),
        });
        // Cap at 100 entries
        const trimmed = log.slice(-100);
        await chrome.storage.local.set({ [STORAGE_KEYS.FLOW_BREAKER_LOG]: trimmed });
      } catch (e) { }
    })();
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
    if (bytes.byteLength > 5000000) return null;
    const chunkSize = 0x8000;
    const chunks = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(chunks.join(''));
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

  // 1. Try JSON3 format first (preferred â€” structured, no XML ambiguity)
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
  } catch (e) { /* not JSON â€” try XML */ }

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

      // Order: en â†’ en-XX â†’ any ASR â†’ first available
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
      'â†’ transcript:', transcript ? `${transcript.length} chars` : 'null',
      'â†’ genre:', genre, 'â†’ channel:', channel);

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

