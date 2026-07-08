// DopaQueue background service worker.
// Owns the daily Dopamine Budget: the only place that decrements
// budgetMinutesUsed. Popup only reads game state and appends to the
// queue, so there's a single writer for the time-based decay logic.

import { supabaseClient } from '../shared/supabase.js';
import { isMindlessScrollUrl } from '../shared/constants.js';
import {
  initStorage,
  checkDailyReset,
  getGameState,
  updateGameState,
  cacheScrapeResult,
  getScrapeResult,
  getUrlChannel,
  isWhitelistedChannel,
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

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    await handleTabChange(tab);
  }
});

async function getActiveFocusedTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GENRE_SCRAPED') {
    initStorage().then(() => {
      cacheScrapeResult(message.url, {
        genre: message.genre || null,
        channel: message.channel || null,
        transcript: message.transcript || null,
      });
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

  return false;
});

async function fetchTranscriptFallback(videoId) {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    // Fetch without credentials omit to allow browser cookies and session context,
    // which prevents YouTube from redirecting to a cookie consent form.
    const res = await fetch(watchUrl);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const html = await res.text();

    // 1. Scrape category
    let genre = null;
    const genreMatch = html.match(/<meta itemprop="genre" content="([^"]+)">/);
    if (genreMatch) {
      genre = genreMatch[1];
    } else {
      const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)">/);
      if (keywordsMatch) {
        genre = keywordsMatch[1].split(',')[0]?.trim();
      }
    }

    // 2. Scrape channel
    let channel = null;
    const channelMatch = html.match(/<link itemprop="name" content="([^"]+)">/);
    if (channelMatch) {
      channel = channelMatch[1];
    }

    // 3. Scrape transcript using balanced-brace scan (bulletproof compared to regular expressions)
    let transcript = null;
    let player = null;
    
    let searchIdx = 0;
    while (true) {
      const idx = html.indexOf('ytInitialPlayerResponse', searchIdx);
      if (idx === -1) break;
      
      searchIdx = idx + 23; // Advance search index
      
      const braceStart = html.indexOf('{', idx);
      if (braceStart === -1) continue;
      
      let depth = 0;
      let i = braceStart;
      let found = false;
      for (; i < html.length; i++) {
        const ch = html[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            found = true;
            break;
          }
        }
      }
      if (!found) continue;
      
      const jsonText = html.slice(braceStart, i + 1);
      try {
        const parsed = JSON.parse(jsonText);
        if (parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
          player = parsed;
          break; // Found the player response with caption tracks!
        }
      } catch (e) {
        // Try next occurrence
      }
    }

    if (player) {
      const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (tracks && tracks.length > 0) {
        const enTrack = tracks.find(t => t.languageCode === 'en') || tracks[0];
        if (enTrack?.baseUrl) {
          const captionRes = await fetch(enTrack.baseUrl);
          if (captionRes.ok) {
            const xmlText = await captionRes.text();
            const textMatches = xmlText.match(/<text[^>]*>([\s\S]*?)<\/text>/g);
            if (textMatches) {
              transcript = textMatches.map(t => {
                return t.replace(/<text[^>]*>/, '').replace(/<\/text>/, '')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&apos;/g, "'")
                  .replace(/\s+/g, ' ')
                  .trim();
              }).join(' ');
            }
          }
        }
      }
    }

    return { genre, channel, transcript };
  } catch (err) {
    console.error('DopaQueue background: fetchTranscriptFallback error', err);
    throw err;
  }
}

// Cover the edge case where the service worker was asleep and this
// module just spun back up in response to an event.
ensureBudgetAlarm();
refreshBadge();
