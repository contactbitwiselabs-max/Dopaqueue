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
  getSettings,
  localGameState,
} from '../shared/storage.js';
import { autoSyncItem } from '../shared/sync.js';

const BUDGET_TICK_ALARM = 'budgetTick';
const REVIEW_DECK_ALARM = 'reviewDeckTick';

// Allow-list for PAGE_FETCH proxy requests (B5/S4: prevent SSRF + data exfiltration).
// Covers all platforms the extension legitimately scrapes metadata/thumbnails from.
const PAGE_FETCH_ALLOWED_HOSTS = new Set([
  // YouTube
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'i.ytimg.com',
  'img.youtube.com',
  'googlevideo.com',
  'manifest.googlevideo.com',
  'rr1---sn-googlevideo.com',
  'studios.youtube.com',
  // Instagram
  'instagram.com',
  'www.instagram.com',
  'cdninstagram.com',
  'scontent.cdninstagram.com',
  // TikTok
  'tiktok.com',
  'www.tiktok.com',
  'p16-sign.tiktokcdn.com',
  'p19-sign.tiktokcdn.com',
  // Twitter / X
  'twitter.com',
  'x.com',
  'pbs.twimg.com',
  'video.twimg.com',
  // Reddit
  'reddit.com',
  'www.reddit.com',
  'i.redd.it',
  'v.redd.it',
  'preview.redd.it',
  // LinkedIn
  'linkedin.com',
  'www.linkedin.com',
  'media.licdn.com',
]);


// Also reject private/internal IP ranges to prevent SSRF
function isPrivateIp(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('192.168.') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function isPageFetchAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (isPrivateIp(parsed.hostname)) return false;
    // Check exact match first, then subdomain match
    if (PAGE_FETCH_ALLOWED_HOSTS.has(parsed.hostname)) return true;
    for (const allowed of PAGE_FETCH_ALLOWED_HOSTS) {
      if (parsed.hostname.endsWith('.' + allowed)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

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
    const domain = (() => { try { return new URL(tab.url || 'https://example.com').hostname.replace(/^www\./, ''); } catch { return ''; } })();
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
    const domain = tab?.url ? (() => { try { return new URL(tab.url).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '';
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
    // B2: Always save the queue item directly here. The content-script
    // enrichment path (alt text, caption extraction) can run in parallel
    // and update the item via SAVE_ITEM later — never rely on it for the
    // initial queue write, or the user sees "saved!" but nothing is queued.
    try {
      if (tab?.id) {
        // Ask content script for enrichment metadata (alt text, page title)
        // but DON'T block the actual save on a response.
        chrome.tabs.sendMessage(tab.id, { type: 'SAVE_IMAGE_FROM_CONTEXT', srcUrl: info.srcUrl, entryId: entry.id }).catch(() => {});
      }
    } catch { /* content script not reachable — we still saved above */ }
    addToQueue(entry);
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

// D2: Handle keyboard shortcut "save-page" (Ctrl/Cmd+Shift+S)
chrome.commands?.onCommand?.addListener(async (command: string) => {
  if (command !== 'save-page') return;
  await initStorage();
  const tab = await getActiveFocusedTab();
  if (!tab || !tab.url) return;
  const domain = (() => { try { return new URL(tab.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const entry = {
    id: crypto.randomUUID(),
    url: tab.url,
    title: (tab.title || tab.url).slice(0, 200),
    thumbnail: tab.favIconUrl || null,
    platform: detectPlatformFromUrl(tab.url),
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
  // B8: Re-read fresh gameState from chrome.storage.local in case another
  // context (popup/dashboard) wrote a different state since worker startup.
  try {
    const fresh = await chrome.storage.local.get(STORAGE_KEYS.GAME);
    if (fresh && fresh[STORAGE_KEYS.GAME]) {
      // Merge fresh values over in-memory state (preserves any changes this worker made)
      Object.assign(localGameState, fresh[STORAGE_KEYS.GAME]);
    }
  } catch (e) {
    // Fall back to in-memory state if storage read fails
  }
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
  // S11: Sender validation — only accept messages from our extension's
  // content scripts, popup, or background contexts. Reject anything else
  // to prevent external pages from spoofing save/scrape messages.
  if (sender && sender.id && sender.id !== chrome.runtime.id) {
    // Message from a different extension — ignore for safety
    return false;
  }

  // S11: Validate the message envelope before any handler runs
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'GET_TIMER_STATE') {
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
    // B5/S4: Validate URL against allow-list to prevent SSRF.
    if (!isPageFetchAllowed(message.url)) {
      sendResponse({ ok: false, error: 'URL not allowed' });
      return false;
    }
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

      const settings = getSettings();
      if (settings.autoSyncEnabled) {
        autoSyncItem(saved).catch(err => console.warn('DopaQueue: autoSyncItem failed', err));
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

        // Inject the overlay as an inline function — avoids hashed file-path issues in MV3.
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Don't inject twice
            if (document.getElementById('dq-screenshot-overlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'dq-screenshot-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.35);user-select:none;';

            const selection = document.createElement('div');
            selection.id = 'dq-screenshot-selection';
            selection.style.cssText = 'position:absolute;border:2px solid #a3e635;background:rgba(163,230,53,0.08);box-shadow:0 0 0 9999px rgba(0,0,0,0.3);pointer-events:none;display:none;';

            const hint = document.createElement('div');
            hint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-family:system-ui,sans-serif;font-size:15px;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,0.8);pointer-events:none;text-align:center;line-height:1.5;';
            hint.textContent = 'Drag to select the area to capture\nPress Esc to cancel';

            overlay.appendChild(selection);
            overlay.appendChild(hint);
            document.body.appendChild(overlay);

            let startX = 0, startY = 0, dragging = false;

            function getRect(x1, y1, x2, y2) {
              return { x: Math.min(x1,x2), y: Math.min(y1,y2), width: Math.abs(x2-x1), height: Math.abs(y2-y1) };
            }
            function updateSel(cx, cy) {
              const r = getRect(startX, startY, cx, cy);
              selection.style.left = r.x + 'px'; selection.style.top = r.y + 'px';
              selection.style.width = r.width + 'px'; selection.style.height = r.height + 'px';
            }
            function cleanup() {
              document.removeEventListener('keydown', onEsc);
              overlay.remove();
            }
            function onEsc(e) {
              if (e.key === 'Escape') { cleanup(); chrome.runtime.sendMessage({ type: 'SCREENSHOT_AREA_CANCELLED' }); }
            }

            overlay.addEventListener('mousedown', (e) => {
              if (e.button !== 0) return;
              dragging = true; startX = e.clientX; startY = e.clientY;
              hint.style.display = 'none'; selection.style.display = 'block';
              updateSel(e.clientX, e.clientY);
            });
            overlay.addEventListener('mousemove', (e) => { if (dragging) updateSel(e.clientX, e.clientY); });
            overlay.addEventListener('mouseup', (e) => {
              if (!dragging) return;
              dragging = false;
              const rect = getRect(startX, startY, e.clientX, e.clientY);
              cleanup();
              if (rect.width < 10 || rect.height < 10) {
                chrome.runtime.sendMessage({ type: 'SCREENSHOT_AREA_CANCELLED' }); return;
              }
              chrome.runtime.sendMessage({
                type: 'SCREENSHOT_AREA_SELECTED',
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), devicePixelRatio: window.devicePixelRatio || 1 },
              });
            });
            document.addEventListener('keydown', onEsc);
          },
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
        
        // Crop using OffscreenCanvas
        const rect = message.rect;
        // B12: Default devicePixelRatio to 1 if missing — prevents NaN crop
        const dpr = (typeof rect.devicePixelRatio === 'number' && rect.devicePixelRatio > 0)
          ? rect.devicePixelRatio
          : 1;
        const res = await fetch(fullDataUrl);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        
        const canvas = new OffscreenCanvas(rect.width, rect.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2d context');
        
        // Draw the cropped area (B12: use safe dpr)
          ctx.drawImage(bitmap, rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr, 0, 0, rect.width, rect.height);
        
        const croppedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
        
        // Save blob
        const { saveBlob } = await import('../shared/blobStore.js');
        const blobId = await saveBlob(croppedBlob, 'image/jpeg');

        // Create and save QueueItem
        const url = tab.url || '';
        const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
        
        const entry = {
          id: crypto.randomUUID(),
          url,
          title: tab.title || 'Screenshot',
          thumbnail: tab.favIconUrl || null,
          platform: detectPlatformFromUrl(url),
          contentType: 'screenshot',
          type: 'screenshot',
          tags: [],
          sourceDomain: domain,
          blobId,
          savedAt: Date.now(),
          watched: false,
        };

        const { addToQueue, getSettings } = await import('../shared/storage.js');
        addToQueue(entry);
        
        const settings = getSettings();
        if (settings.autoSyncEnabled) {
          const { autoSyncItem } = await import('../shared/sync.js');
          autoSyncItem(entry).catch(e => console.warn('Sync failed', e));
        }

        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('src/icons/icon48.png'),
          title: 'DopaQueue',
          message: 'Area screenshot saved to Queue!',
        });

        sendResponse({ ok: true });
      } catch (err) {
        console.error('Screenshot error:', err);
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

      const settings = getSettings();
      if (settings.autoSyncEnabled) {
        autoSyncItem(entry).catch(err => console.warn('DopaQueue: autoSyncItem failed', err));
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
    // S4: Restrict to https/http and reject private IPs
    if (!isPageFetchAllowed(url)) {
      console.warn('DopaQueue background: fetchBase64Image rejected URL (not allow-listed):', url);
      return null;
    }
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.byteLength > 5000000) return null;
    // B13: Safe base64 encoding that doesn't overflow engine arg limits.
    // Use FileReader if available (service workers have it), else chunk manually.
    if (typeof FileReader !== 'undefined') {
      const blob = new Blob([bytes], { type: contentType });
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
    // Fallback: chunk-based base64 with small chunk size (safe for V8)
    const chunkSize = 0x2000; // 8KB chunks
    let base64 = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      // String.fromCharCode with spread on small chunks is safe
      base64 += btoa(String.fromCharCode(...chunk));
    }
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

// B16: Cover the edge case where the service worker was asleep and this
// module just spun back up in response to an event.
// Note: ensureBudgetAlarm and refreshBadge are safe to call at module top-level
// because they are idempotent and handle uninitialized storage gracefully.
// We DO NOT call initStorage() here — that runs on first event, not at import.
ensureBudgetAlarm();
refreshBadge().catch(() => { /* SW may not have storage yet — onInstalled will retry */ });

