// chrome.storage.local helpers shared by background.js, popup.js, and the web app (dashboard).
import {
  STORAGE_KEYS,
  DEFAULT_GAME_STATE,
  DEFAULT_SETTINGS,
  MAX_SCRAPE_CACHE_ENTRIES,
  MAX_URL_CHANNEL_ENTRIES,
  getPlantStatus,
  todayLocalDateString,
} from './constants.js';
import {
  validateQueueItem,
  validateSettings,
  validateAIConfig,
  validateString,
  validateUrl,
} from './validation.js';

// --- Pub/Sub ---
const listeners = new Map();

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}

function notify(key, value) {
  const subs = listeners.get(key);
  if (subs) subs.forEach(cb => cb(value));
}

// --- In-memory synchronous state ---
export let localQueue = [];
export let localNotes = [];
export let localGameState = { ...DEFAULT_GAME_STATE };
export let localSettings = { ...DEFAULT_SETTINGS };
export let localCache = {};
export let localWhitelist = [];
export let localUrlChannels = {};
export let localPomodoro = { active: false, remainingSeconds: 1500, label: 'Focus Block' };

let initialized = false;

// Resets the daily budget if the last reset was on an earlier day.
// Returns true if a reset was applied. Pure state mutation + persist;
// safe to call repeatedly (no-op when already reset today).
function applyDailyReset() {
  const today = todayLocalDateString();
  if (localGameState.lastResetDate === today || localGameState.lastReset === today) {
    return false;
  }
  localGameState = {
    ...localGameState,
    budgetMinutesUsed: 0,
    budgetMinutesTotal: localSettings.dailyBudgetMinutes,
    notifiedZeroToday: false,
    lastResetDate: today,
    lastReset: today,
  };
  localGameState.plant = getPlantStatus(
    localGameState.budgetMinutesTotal - localGameState.budgetMinutesUsed,
    localGameState.budgetMinutesTotal
  );
  storageSet(STORAGE_KEYS.GAME, localGameState);
  notify(STORAGE_KEYS.GAME, localGameState);
  return true;
}

// Public entry point so long-lived contexts (e.g. the background
// service worker on each budget tick) can re-check the daily reset
// without re-running the whole initStorage() hydration.
export function checkDailyReset() {
  return applyDailyReset();
}

// Initialize state from chrome.storage.local
export async function initStorage() {
  if (initialized) return;
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.local.get([
      STORAGE_KEYS.QUEUE,
      STORAGE_KEYS.NOTES,
      STORAGE_KEYS.GAME,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.SCRAPE_CACHE,
      STORAGE_KEYS.WHITELIST,
      STORAGE_KEYS.POMODORO,
      STORAGE_KEYS.URL_CHANNELS,
      STORAGE_KEYS.AI_CONFIG,
      STORAGE_KEYS.CONFIG,
    ], (res) => {
      // Check for errors or undefined responses to prevent crashes
      if (chrome.runtime.lastError) {
        console.error('initStorage error:', chrome.runtime.lastError);
      }
      if (!res) res = {}; // Fallback to empty object if get fails

      // Validate and sanitize all loaded data
      localQueue = Array.isArray(res[STORAGE_KEYS.QUEUE])
        ? res[STORAGE_KEYS.QUEUE].map(item => validateQueueItem(item)).filter(Boolean)
        : [];
      
      localNotes = Array.isArray(res[STORAGE_KEYS.NOTES])
        ? res[STORAGE_KEYS.NOTES].map(note => ({
            ...note,
            text: validateString(note.text, { maxLength: 5000, allowEmpty: true }) || '',
            videoId: validateString(note.videoId, { maxLength: 50, allowEmpty: false }) || null,
          })).filter(note => note.text || note.videoId)
        : [];
      
      localGameState = { ...DEFAULT_GAME_STATE, ...(res[STORAGE_KEYS.GAME] || {}) };
      
      // Validate settings
      localSettings = validateSettings({ ...DEFAULT_SETTINGS, ...(res[STORAGE_KEYS.SETTINGS] || {}) });
      
      localCache = res[STORAGE_KEYS.SCRAPE_CACHE] || {};
      localWhitelist = Array.isArray(res[STORAGE_KEYS.WHITELIST])
        ? res[STORAGE_KEYS.WHITELIST].map(w => validateString(w, { maxLength: 100, allowEmpty: false })).filter(Boolean)
        : [];
      
      localUrlChannels = res[STORAGE_KEYS.URL_CHANNELS] || {};
      localPomodoro = { active: false, remainingSeconds: 1500, label: 'Focus Block', ...(res[STORAGE_KEYS.POMODORO] || {}) };

      // Perform daily reset check for game state
      applyDailyReset();

      initialized = true;
      notify(STORAGE_KEYS.QUEUE, localQueue);
      notify(STORAGE_KEYS.NOTES, localNotes);
      notify(STORAGE_KEYS.GAME, localGameState);
      notify(STORAGE_KEYS.SETTINGS, localSettings);
      resolve();
    });
  });
}

// Listen for cross-context changes (e.g. extension saves a video while dashboard is open)
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes[STORAGE_KEYS.QUEUE]) {
        localQueue = Array.isArray(changes[STORAGE_KEYS.QUEUE].newValue)
          ? changes[STORAGE_KEYS.QUEUE].newValue.map(item => validateQueueItem(item)).filter(Boolean)
          : [];
        notify(STORAGE_KEYS.QUEUE, localQueue);
      }
      if (changes[STORAGE_KEYS.NOTES]) {
        localNotes = Array.isArray(changes[STORAGE_KEYS.NOTES].newValue)
          ? changes[STORAGE_KEYS.NOTES].newValue
          : [];
        notify(STORAGE_KEYS.NOTES, localNotes);
      }
      if (changes[STORAGE_KEYS.GAME]) {
        localGameState = { ...DEFAULT_GAME_STATE, ...(changes[STORAGE_KEYS.GAME].newValue || {}) };
        notify(STORAGE_KEYS.GAME, localGameState);
      }
      if (changes[STORAGE_KEYS.SETTINGS]) {
        localSettings = validateSettings({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEYS.SETTINGS].newValue || {}) });
        notify(STORAGE_KEYS.SETTINGS, localSettings);
      }
      if (changes[STORAGE_KEYS.WHITELIST]) {
        localWhitelist = Array.isArray(changes[STORAGE_KEYS.WHITELIST].newValue)
          ? changes[STORAGE_KEYS.WHITELIST].newValue
          : [];
        notify(STORAGE_KEYS.WHITELIST, localWhitelist);
      }
      if (changes[STORAGE_KEYS.SCRAPE_CACHE]) {
        localCache = changes[STORAGE_KEYS.SCRAPE_CACHE].newValue || {};
        notify(STORAGE_KEYS.SCRAPE_CACHE, localCache);
      }
      if (changes[STORAGE_KEYS.POMODORO]) {
        localPomodoro = {
          active: false,
          remainingSeconds: 1500,
          label: 'Focus Block',
          ...(changes[STORAGE_KEYS.POMODORO].newValue || {}),
        };
        notify(STORAGE_KEYS.POMODORO, localPomodoro);
      }
    }
  });
}

function storageSet(key, value) {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  chrome.storage.local.set({ [key]: value });
}

// --- Queue ---
export function getQueue() { return localQueue; }
export function getSavedVideos() { return localQueue.filter(item => item.type !== 'channel' && !item.deleted); }
export function getSavedChannels() { return localQueue.filter(item => item.type === 'channel' && !item.deleted); }

export function setQueue(queue) {
  localQueue = queue;
  storageSet(STORAGE_KEYS.QUEUE, queue);
}

/**
 * Add an item to the queue with validation
 * @param {Object} entry - Queue entry to add
 * @returns {Object|null} The added entry or null if invalid
 */
export function addToQueue(entry) {
  // Validate the entry before adding
  const validatedEntry = validateQueueItem(entry);
  if (!validatedEntry) {
    console.warn('[DopaQueue] Attempted to add invalid entry to queue:', entry);
    return null;
  }
  
  // Ensure entry has required fields
  validatedEntry.id = validatedEntry.id || crypto.randomUUID();
  validatedEntry.updatedAt = Date.now();
  validatedEntry.savedAt = validatedEntry.savedAt || Date.now();
  
  localQueue = [...localQueue, validatedEntry];
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return validatedEntry;
}

/**
 * Update a queue item with validation
 * @param {string} id - Item ID to update
 * @param {Object} patch - Partial update
 * @returns {Object|null} The updated item or null if not found
 */
export function updateQueueItem(id, patch) {
  const validatedPatch = {};
  
  // Validate each field in the patch
  if (patch.title !== undefined) {
    validatedPatch.title = validateString(patch.title, { maxLength: 200, allowEmpty: false }) || null;
  }
  if (patch.url !== undefined) {
    validatedPatch.url = validateUrl(patch.url, { requireVideoPlatform: true });
  }
  if (patch.channel !== undefined) {
    validatedPatch.channel = validateString(patch.channel, { maxLength: 100, allowEmpty: true }) || null;
  }
  if (patch.author !== undefined) {
    validatedPatch.author = validateString(patch.author, { maxLength: 100, allowEmpty: true }) || null;
  }
  if (patch.authorUrl !== undefined) {
    validatedPatch.authorUrl = validateUrl(patch.authorUrl) || null;
  }
  if (patch.thumbnail !== undefined) {
    validatedPatch.thumbnail = validateUrl(patch.thumbnail) || null;
  }
  if (patch.platform !== undefined) {
    validatedPatch.platform = validateString(patch.platform, { maxLength: 20, allowEmpty: true }) || null;
  }
  if (patch.contentType !== undefined) {
    validatedPatch.contentType = validateString(patch.contentType, { maxLength: 20, allowEmpty: true }) || null;
  }
  if (patch.transcript !== undefined) {
    validatedPatch.transcript = validateString(patch.transcript, { maxLength: 50000, allowEmpty: true }) || null;
  }
  if (patch.notes !== undefined) {
    validatedPatch.notes = validateNote(patch.notes) || null;
  }
  if (patch.tags !== undefined) {
    validatedPatch.tags = Array.isArray(patch.tags) ? patch.tags : [];
  }
  if (patch.watched !== undefined) {
    validatedPatch.watched = Boolean(patch.watched);
  }
  if (patch.deleted !== undefined) {
    validatedPatch.deleted = Boolean(patch.deleted);
  }
  if (patch.group !== undefined) {
    validatedPatch.group = validateString(patch.group, { maxLength: 50, allowEmpty: true }) || null;
  }

  localQueue = localQueue.map((item) => 
    item.id === id ? { ...item, ...validatedPatch, updatedAt: Date.now() } : item
  );
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return localQueue.find(item => item.id === id);
}

export function updateChannelGroup(id, group) { 
  return updateQueueItem(id, { group }); 
}

/**
 * Remove an item from the queue (soft delete for sync)
 * @param {string} id - Item ID to remove
 * @returns {Array} Queue without the deleted item
 */
export function removeFromQueue(id) {
  // Soft delete for sync engine
  localQueue = localQueue.map(item => 
    item.id === id ? { ...item, deleted: true, updatedAt: Date.now() } : item
  );
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return localQueue.filter(i => !i.deleted);
}

// --- Notes ---
export function getNotes() { return localNotes; }

export function setNotes(notes) {
  localNotes = notes;
  storageSet(STORAGE_KEYS.NOTES, notes);
}

/**
 * Add a note with validation
 * @param {Object} note - Note to add
 * @returns {Object|null} The added note or null if invalid
 */
export function addNote(note) {
  const validatedNote = {
    id: note.id || crypto.randomUUID(),
    text: validateString(note.text, { maxLength: 5000, allowEmpty: false }) || '',
    videoId: validateString(note.videoId, { maxLength: 50, allowEmpty: false }) || null,
    createdAt: note.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  
  if (!validatedNote.text) {
    console.warn('[DopaQueue] Attempted to add note without text');
    return null;
  }
  
  localNotes = [...localNotes, validatedNote];
  storageSet(STORAGE_KEYS.NOTES, localNotes);
  return validatedNote;
}

// --- Settings ---
export function getSettings() { return localSettings; }

/**
 * Set settings with validation
 * @param {Object} settings - Settings to set
 * @returns {Object} The validated settings
 */
export function setSettings(settings) {
  const validatedSettings = validateSettings(settings);
  validatedSettings.updatedAt = Date.now();
  localSettings = validatedSettings;
  storageSet(STORAGE_KEYS.SETTINGS, validatedSettings);
  return validatedSettings;
}

// --- Game State ---
export function getGameStateRaw() { return localGameState; }
export function getGameState() { return localGameState; }

export function setGameState(game) {
  game.updatedAt = Date.now();
  localGameState = game;
  storageSet(STORAGE_KEYS.GAME, game);
}

export function updateGameState(patch) {
  localGameState = { ...localGameState, ...patch, updatedAt: Date.now() };
  localGameState.plant = getPlantStatus(
    localGameState.budgetMinutesTotal - localGameState.budgetMinutesUsed,
    localGameState.budgetMinutesTotal
  );
  storageSet(STORAGE_KEYS.GAME, localGameState);
  return localGameState;
}

// --- Cache ---
export function getScrapeCache() { return localCache; }

export function setScrapeCache(cache) {
  localCache = cache;
  storageSet(STORAGE_KEYS.SCRAPE_CACHE, cache);
}

export function getScrapeResult(url) {
  return localCache[url] || null;
}

/**
 * Cache a scrape result with validation
 * @param {string} url - URL to cache
 * @param {Object} data - Scrape data
 * @returns {Object} The updated cache
 */
export function cacheScrapeResult(url, data) {
  const validatedUrl = validateUrl(url);
  if (!validatedUrl) {
    console.warn('[DopaQueue] Attempted to cache invalid URL:', url);
    return localCache;
  }
  
  const validatedData = {
    ...data,
    url: validatedUrl,
    channel: validateString(data.channel, { maxLength: 100, allowEmpty: true }) || null,
    author: validateString(data.author, { maxLength: 100, allowEmpty: true }) || null,
    authorUrl: validateUrl(data.authorUrl) || null,
    thumbnail: validateUrl(data.thumbnail) || null,
    title: validateString(data.title, { maxLength: 200, allowEmpty: true }) || null,
    transcript: validateString(data.transcript, { maxLength: 50000, allowEmpty: true }) || null,
    genre: validateString(data.genre, { maxLength: 50, allowEmpty: true }) || null,
    scrapedAt: Date.now(),
  };
  
  localCache[validatedUrl] = validatedData;
  
  // Persist the URL->channel mapping in the eviction-proof map so the
  // whitelist check in budgetTick() keeps working after LRU trimming.
  if (validatedData.channel) {
    rememberUrlChannel(validatedUrl, validatedData.channel);
  }
  
  trimScrapeCache();
  storageSet(STORAGE_KEYS.SCRAPE_CACHE, localCache);
  return localCache;
}

// Trim scrape cache by entry count and total size (transcripts can be large)
export function trimScrapeCache() {
  const entries = Object.entries(localCache);
  if (entries.length <= MAX_SCRAPE_CACHE_ENTRIES) return;
  
  // Sort by scrapedAt descending (newest first)
  entries.sort((a, b) => b[1].scrapedAt - a[1].scrapedAt);
  
  // Keep only newest MAX_SCRAPE_CACHE_ENTRIES
  localCache = Object.fromEntries(entries.slice(0, MAX_SCRAPE_CACHE_ENTRIES));
}

// Check total cache size in bytes (for monitoring)
export function getScrapeCacheSize() {
  return Object.entries(localCache).reduce((sum, [url, data]) => {
    return sum + url.length + (data.transcript ? data.transcript.length : 0);
  }, 0);
}

// Records the channel for a mindless-scroll URL in a lightweight,
// dedicated map that is NOT subject to the scrape-cache LRU eviction.
// This lets budgetTick() reliably decide whether the current channel is
// whitelisted even after the heavy transcript cache has evicted the URL.
export function rememberUrlChannel(url, channel) {
  if (!url || !channel) return;
  
  const validatedUrl = validateUrl(url);
  const validatedChannel = validateString(channel, { maxLength: 100, allowEmpty: false });
  
  if (!validatedUrl || !validatedChannel) return;
  
  if (localUrlChannels[validatedUrl] === validatedChannel) return;
  
  localUrlChannels[validatedUrl] = validatedChannel;
  
  // Cap the map so it can't grow unbounded.
  const keys = Object.keys(localUrlChannels);
  if (keys.length > MAX_URL_CHANNEL_ENTRIES) {
    delete localUrlChannels[keys[0]];
  }
  
  storageSet(STORAGE_KEYS.URL_CHANNELS, localUrlChannels);
}

export function getUrlChannel(url) {
  if (!url) return null;
  return localUrlChannels[url] || null;
}

// --- Reset ---
export function resetAllData() {
  localQueue = [];
  localNotes = [];
  localGameState = { ...DEFAULT_GAME_STATE, updatedAt: Date.now() };
  localSettings = { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
  localWhitelist = [];
  localPomodoro = { active: false, remainingSeconds: 1500, label: 'Focus Block' };
  
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  storageSet(STORAGE_KEYS.NOTES, localNotes);
  storageSet(STORAGE_KEYS.GAME, localGameState);
  storageSet(STORAGE_KEYS.SETTINGS, localSettings);
  storageSet(STORAGE_KEYS.WHITELIST, localWhitelist);
  storageSet(STORAGE_KEYS.POMODORO, localPomodoro);
}

// --- Whitelist Helpers ---
export function getWhitelist() {
  return [...localWhitelist];
}

/**
 * Save whitelist with validation
 * @param {Array} list - Whitelist to save
 * @returns {Array} The validated whitelist
 */
export function saveWhitelist(list) {
  localWhitelist = Array.isArray(list)
    ? list.map(w => validateString(w, { maxLength: 100, allowEmpty: false })).filter(Boolean)
    : [];
  storageSet(STORAGE_KEYS.WHITELIST, localWhitelist);
  return localWhitelist;
}

export function isWhitelistedChannel(channelName) {
  if (!channelName) return false;
  const norm = channelName.toLowerCase().trim();
  return localWhitelist.some(c => c && c.toLowerCase().trim() === norm);
}

// --- Pomodoro State Helpers ---
export function getPomodoroState() {
  return { ...localPomodoro };
}

/**
 * Save pomodoro state with validation
 * @param {Object} state - Pomodoro state to save
 * @returns {Object} The validated pomodoro state
 */
export function savePomodoroState(state) {
  const validatedState = {
    active: Boolean(state.active),
    remainingSeconds: typeof state.remainingSeconds === 'number' 
      ? Math.max(0, Math.min(3600, Math.floor(state.remainingSeconds))) 
      : localPomodoro.remainingSeconds,
    label: validateString(state.label, { maxLength: 50, allowEmpty: true }) || localPomodoro.label,
  };
  
  localPomodoro = { ...localPomodoro, ...validatedState };
  storageSet(STORAGE_KEYS.POMODORO, localPomodoro);
  return localPomodoro;
}

// --- AI Configuration ---
/**
 * Get AI configuration
 * @returns {Object} AI configuration
 */
export function getAIConfig() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    // This is synchronous in extension context, but we need async for proper validation
    // For now, return from memory or defaults
    return localSettings.aiProvider && localSettings.aiApiKey
      ? { provider: localSettings.aiProvider, apiKey: localSettings.aiApiKey }
      : { provider: 'local', apiKey: '' };
  }
  return { provider: 'local', apiKey: '' };
}

/**
 * Set AI configuration with validation
 * @param {Object} config - AI configuration
 * @returns {Object} Validated AI configuration
 */
export async function setAIConfig(config) {
  const validatedConfig = validateAIConfig(config);
  
  // Update settings with validated AI config
  const updatedSettings = {
    ...localSettings,
    aiProvider: validatedConfig.provider,
    aiApiKey: validatedConfig.apiKey,
    updatedAt: Date.now(),
  };
  
  localSettings = validateSettings(updatedSettings);
  storageSet(STORAGE_KEYS.SETTINGS, localSettings);
  
  return validatedConfig;
}

export async function ensureChannelSaved(channelId, channelName, thumbnailUrl) { return true; }
