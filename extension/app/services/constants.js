// Shared constants for the DopaQueue web app.
// Values mirror extension/shared/constants.js — kept in sync manually
// since the extension and web app are separate runtimes with separate
// storage (chrome.storage.local vs localStorage) and can't share a module.

export const STORAGE_KEYS = {
  QUEUE: 'dq_queue',
  NOTES: 'dq_notes',
  GAME: 'dq_game',
  SETTINGS: 'dq_settings',
};

export const DEFAULT_GAME_STATE = {
  plant: 'thriving',
  coins: 0,
  budgetMinutesTotal: 60,
  budgetMinutesUsed: 0,
  lastReset: null,
};

export const DEFAULT_SETTINGS = {
  dailyBudgetMinutes: 60,
  reminderHours: 48,
  aiProvider: 'gemini',
  aiApiKey: '',
  notificationsEnabled: true,
};

// Plant status thresholds, based on % of daily budget remaining.
export const PLANT_THRESHOLDS = {
  THRIVING: 0.7,
  OKAY: 0.3,
};

export const NOTE_COINS_REWARD = 10;
export const NOTE_BUDGET_RESTORE_MINUTES = 15;
export const SNOOZE_HOURS = 48;

export function todayLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
