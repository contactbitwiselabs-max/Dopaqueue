// Shared constants for the DopaQueue extension.
// These are exported as an ES module so background.js (service worker,
// type: "module") and popup.js (type="module") can both import them.
// content.js is a classic script and must NOT import this file — MV3
// content scripts don't support ES module imports, so any constant it
// needs is duplicated inline there.

export const STORAGE_KEYS = {
  QUEUE: 'dq_queue',
  GAME: 'dq_game',
  SETTINGS: 'dq_settings',
  SCRAPE_CACHE: 'dq_scrape_cache',
};

export const DEFAULT_GAME_STATE = {
  plant: 'thriving',
  coins: 0,
  budgetMinutesTotal: 60,
  budgetMinutesUsed: 0,
  lastReset: null, // set on first read to today's local date string
  notifiedZeroToday: false,
};

export const DEFAULT_SETTINGS = {
  dailyBudgetMinutes: 60,
  reminderHours: 48,
  aiProvider: 'gemini',
  aiApiKey: '',
  notificationsEnabled: true,
};

// Plant status thresholds, based on % of daily budget remaining.
// The spec's data model lists "dead" as a valid enum value alongside
// thriving/okay/wilting but only describes three bands in prose — we
// add "dead" for the 0%-remaining case so the enum is fully reachable.
export const PLANT_THRESHOLDS = {
  THRIVING: 0.7,
  OKAY: 0.3,
};

export function getPlantStatus(minutesRemaining, budgetMinutesTotal) {
  if (budgetMinutesTotal <= 0) return 'dead';
  const pct = minutesRemaining / budgetMinutesTotal;
  if (pct <= 0) return 'dead';
  if (pct >= PLANT_THRESHOLDS.THRIVING) return 'thriving';
  if (pct >= PLANT_THRESHOLDS.OKAY) return 'okay';
  return 'wilting';
}

// URL matchers for "mindless scroll" surfaces called out in the spec:
// YouTube Shorts and Instagram Reels.
export const MINDLESS_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/shorts\//i,
  /^https?:\/\/(www\.)?instagram\.com\/reels?\//i,
];

export function isMindlessScrollUrl(url) {
  if (!url) return false;
  return MINDLESS_URL_PATTERNS.some((re) => re.test(url));
}

// Extracts a YouTube video ID from watch/shorts/short-link URLs, or
// null if the URL isn't a recognizable YouTube video URL.
export function extractYouTubeVideoId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/i.test(u.hostname) && u.hostname !== 'youtu.be') {
      return null;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id || null;
    }
    if (u.pathname === '/watch') {
      return u.searchParams.get('v');
    }
    const shortsMatch = u.pathname.match(/^\/shorts\/([^/?]+)/);
    if (shortsMatch) return shortsMatch[1];
    return null;
  } catch {
    return null;
  }
}

export function todayLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// URL matchers for Channel pages (YouTube and Instagram)
export const CHANNEL_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/(@[\w.-]+)/i, // @handle
  /^https?:\/\/(www\.)?youtube\.com\/c\/([\w.-]+)/i, // /c/name
  /^https?:\/\/(www\.)?youtube\.com\/channel\/([\w.-]+)/i, // /channel/id
  /^https?:\/\/(www\.)?youtube\.com\/user\/([\w.-]+)/i, // /user/name
  /^https?:\/\/(www\.)?instagram\.com\/([\w.-]+)\/?$/i, // /username (needs to not be /reels or /p)
];

export function isChannelUrl(url) {
  if (!url) return false;
  // Make sure Instagram URL is not a reel or post
  if (url.includes('instagram.com/reels/') || url.includes('instagram.com/reel/') || url.includes('instagram.com/p/')) {
    return false;
  }
  return CHANNEL_URL_PATTERNS.some((re) => re.test(url));
}

// Extracts a channel ID or handle from channel URLs
export function extractChannelId(url) {
  if (!url) return null;
  if (url.includes('instagram.com/reels/') || url.includes('instagram.com/reel/') || url.includes('instagram.com/p/')) {
    return null;
  }
  for (const re of CHANNEL_URL_PATTERNS) {
    const match = url.match(re);
    if (match && match[2]) {
      return match[2];
    }
  }
  return null;
}
