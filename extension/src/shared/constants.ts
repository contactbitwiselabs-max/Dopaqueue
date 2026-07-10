// Shared constants for the DopaQueue extension.
// These are exported as an ES module so background.js (service worker,
// type: "module") and popup.js (type="module") can both import them.
// content.js is a classic script and must NOT import this file — MV3
// content scripts don't support ES module imports, so any constant it
// needs is duplicated inline there.

import { getValidatedConfig } from './config';
import { GameState, AppSettings } from '../types';

const config = getValidatedConfig();

export const STORAGE_KEYS = {
  QUEUE: 'dq_queue',
  GAME: 'dq_game',
  SETTINGS: 'dq_settings',
  SCRAPE_CACHE: 'dq_scrape_cache',
  NOTES: 'dq_notes',
  WHITELIST: 'dq_whitelist',
  POMODORO: 'dq_pomodoro',
  URL_CHANNELS: 'dq_url_channels',
  TIMER_HISTORY: 'dq_timer_history',
  FLOW_BREAKER_LOG: 'dq_flow_breaker_log',
  AI_CONFIG: 'dq_ai_config',
  CONFIG: 'dq_config',
};

// Cap on the eviction-proof url->channel map used for the whitelist
// check. Tiny values (a URL + a channel name), so a higher cap than the
// scrape cache is fine.
export const MAX_URL_CHANNEL_ENTRIES = 200;

// Base URL of the public landing site used for shareable playlist links.
// Point this at the deployed landing app (e.g. https://dopaqueue.com)
// before release. Never use window.location.origin inside the extension:
// that yields an unusable chrome-extension:// link.
export const SHARE_BASE_URL = config.SHARE_BASE_URL || 'http://localhost:3000';

// Cap on cached scrape results (genre/channel/transcript per URL), kept
// small since transcripts can be large. Shared between storage.js
// (local writes) and sync.js (post-merge trim) so both enforce the
// same limit.
export const MAX_SCRAPE_CACHE_ENTRIES = config.MAX_SCRAPE_CACHE_ENTRIES || 20;

// Default daily budget in minutes
export const DEFAULT_DAILY_BUDGET = config.DEFAULT_DAILY_BUDGET || 60;

export const DEFAULT_GAME_STATE: GameState = {
  health: 100,
  streak: 0,
  lastActive: 0,
  savedToday: 0,
  watchedToday: 0,
  xp: 0,
  level: 1,
  plant: 'thriving',
  coins: 0,
  budgetMinutesTotal: DEFAULT_DAILY_BUDGET,
  budgetMinutesUsed: 0,
  lastReset: undefined,
  notifiedZeroToday: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  dailyBudgetMinutes: DEFAULT_DAILY_BUDGET,
  reminderHours: 48,
  aiProvider: 'local', // 'local', 'gemini', 'openai'
  aiApiKey: '',
  notificationsEnabled: true,
  enableAnalytics: true,
  autoSync: false,
  webhookUrl: '',
  exportTemplate: '',
};

// Plant status thresholds, based on % of daily budget remaining.
// The spec's data model lists "dead" as a valid enum value alongside
// thriving/okay/wilting but only describes three bands in prose — we
// add "dead" for the 0%-remaining case so the enum is fully reachable.
export const PLANT_THRESHOLDS = {
  THRIVING: 0.7,
  OKAY: 0.3,
};

export function getPlantStatus(minutesRemaining: number, budgetMinutesTotal: number): string {
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

export function isMindlessScrollUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return MINDLESS_URL_PATTERNS.some((re) => re.test(url));
}

// isScrollTimerUrl — same surfaces as mindless scroll, used by the timer system.
// Intentionally a separate export so callers can be explicit about which
// check they need (budget vs. timer).
export const isScrollTimerUrl = isMindlessScrollUrl;

// Extracts a YouTube video ID from watch/shorts/short-link URLs, or
// null if the URL isn't a recognizable YouTube video URL.
export function extractYouTubeVideoId(url: string | null | undefined): string | null {
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

export function todayLocalDateString(): string {
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

export function isChannelUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Make sure Instagram URL is not a reel or post
  if (url.includes('instagram.com/reels/') || url.includes('instagram.com/reel/') || url.includes('instagram.com/p/')) {
    return false;
  }
  return CHANNEL_URL_PATTERNS.some((re) => re.test(url));
}

// Extracts a channel ID or handle from channel URLs
export function extractChannelId(url: string | null | undefined): string | null {
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

// Validation utilities
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeString(str: any, maxLength = 10000): string {
  if (!str) return '';
  if (typeof str !== 'string') return String(str);
  return str.trim().slice(0, maxLength);
}

export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!isValidUrl(url)) return null;
  try {
    const parsed = new URL(url!);
    // Remove tracking parameters
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}
