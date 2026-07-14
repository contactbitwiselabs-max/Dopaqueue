// @ts-nocheck
// chrome.storage.local helpers shared by background.js, popup.js, and the web app (dashboard).
import {
  STORAGE_KEYS,
  DEFAULT_GAME_STATE,
  DEFAULT_SETTINGS,
  MAX_SCRAPE_CACHE_ENTRIES,
  MAX_URL_CHANNEL_ENTRIES,
  getPlantStatus,
  todayLocalDateString,
} from './constants';
import {
  validateQueueItem,
  validateSettings,
  validateAIConfig,
  validateString,
  validateUrl,
} from './validation';
import { QueueItem, GameState, AppSettings, PomodoroState, AIConfig, ScrapeData } from '../types';

// --- Pub/Sub ---
type ListenerCallback = (value: any) => void;
const listeners = new Map<string, Set<ListenerCallback>>();

export function subscribe(key: string, callback: ListenerCallback): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(callback);
  return () => listeners.get(key)?.delete(callback);
}

function notify(key: string, value: any) {
  const subs = listeners.get(key);
  if (subs) subs.forEach(cb => cb(value));
}

// --- In-memory synchronous state ---
export let localQueue: QueueItem[] = [];
export let localNotes: any[] = [];
export let localGameState: GameState = { ...DEFAULT_GAME_STATE };
export let localSettings: AppSettings = { ...DEFAULT_SETTINGS };
export let localCache: Record<string, ScrapeData> = {};
export let localWhitelist: string[] = [];
export let localUrlChannels: Record<string, string> = {};
export let localPomodoro: PomodoroState = { active: false, remainingSeconds: 1500, label: 'Focus Block' };

let initialized = false;

// Resets the daily budget if the last reset was on an earlier day.
// Returns true if a reset was applied. Pure state mutation + persist;
// safe to call repeatedly (no-op when already reset today).
function applyDailyReset(): boolean {
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
export function checkDailyReset(): boolean {
  return applyDailyReset();
}

// Initialize state from chrome.storage.local
export async function initStorage(): Promise<void> {
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
    ], (res: any) => {
      // Check for errors or undefined responses to prevent crashes
      if (chrome.runtime.lastError) {
        console.error('initStorage error:', chrome.runtime.lastError);
      }
      if (!res) res = {}; // Fallback to empty object if get fails

      // Validate and sanitize all loaded data
      localQueue = Array.isArray(res[STORAGE_KEYS.QUEUE])
        ? res[STORAGE_KEYS.QUEUE].map((item: any) => validateQueueItem(item)).filter(Boolean) as QueueItem[]
        : [];
      
      localNotes = Array.isArray(res[STORAGE_KEYS.NOTES])
        ? res[STORAGE_KEYS.NOTES].map((note: any) => ({
            ...note,
            text: validateString(note.text, { maxLength: 5000, allowEmpty: true }) || '',
            videoId: validateString(note.videoId, { maxLength: 50, allowEmpty: false }) || null,
          })).filter((note: any) => note.text || note.videoId)
        : [];
      
      localGameState = { ...DEFAULT_GAME_STATE, ...(res[STORAGE_KEYS.GAME] || {}) };
      
      // Validate settings
      localSettings = validateSettings({ ...DEFAULT_SETTINGS, ...(res[STORAGE_KEYS.SETTINGS] || {}) }) as AppSettings;
      
      localCache = (res[STORAGE_KEYS.SCRAPE_CACHE] || {}) as Record<string, ScrapeData>;
      localWhitelist = Array.isArray(res[STORAGE_KEYS.WHITELIST])
        ? res[STORAGE_KEYS.WHITELIST].map((w: any) => validateString(w, { maxLength: 100, allowEmpty: false })).filter(Boolean) as string[]
        : [];
      
      localUrlChannels = (res[STORAGE_KEYS.URL_CHANNELS] || {}) as Record<string, string>;
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
  chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>, area) => {
    if (area === 'local') {
      if (changes[STORAGE_KEYS.QUEUE]) {
        localQueue = Array.isArray(changes[STORAGE_KEYS.QUEUE].newValue)
          ? changes[STORAGE_KEYS.QUEUE].newValue.map((item: any) => validateQueueItem(item)).filter(Boolean) as QueueItem[]
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
        localSettings = validateSettings({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEYS.SETTINGS].newValue || {}) }) as AppSettings;
        notify(STORAGE_KEYS.SETTINGS, localSettings);
      }
      if (changes[STORAGE_KEYS.WHITELIST]) {
        localWhitelist = Array.isArray(changes[STORAGE_KEYS.WHITELIST].newValue)
          ? changes[STORAGE_KEYS.WHITELIST].newValue
          : [];
        notify(STORAGE_KEYS.WHITELIST, localWhitelist);
      }
      if (changes[STORAGE_KEYS.SCRAPE_CACHE]) {
        localCache = (changes[STORAGE_KEYS.SCRAPE_CACHE].newValue || {}) as Record<string, ScrapeData>;
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

function storageSet(key: string, value: any) {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  chrome.storage.local.set({ [key]: value });
}

// --- Queue ---
export function getQueue(): QueueItem[] { return localQueue; }
export function getSavedVideos(): QueueItem[] { return localQueue.filter(item => item.type !== 'channel' && !item.deleted); }
export function getSavedChannels(): QueueItem[] { return localQueue.filter(item => item.type === 'channel' && !item.deleted); }

export function setQueue(queue: QueueItem[]) {
  localQueue = queue;
  storageSet(STORAGE_KEYS.QUEUE, queue);
}

/**
 * Add an item to the queue with validation
 * @param {Object} entry - Queue entry to add
 * @returns {Object|null} The added entry or null if invalid
 */
export function addToQueue(entry: Partial<QueueItem>): QueueItem | null {
  const validatedEntry = validateQueueItem(entry) as QueueItem | null;
  if (!validatedEntry) {
    console.warn('[DopaQueue] Attempted to add invalid entry to queue:', entry);
    return null;
  }
  
  validatedEntry.id = validatedEntry.id || crypto.randomUUID();
  validatedEntry.updatedAt = Date.now();
  validatedEntry.savedAt = validatedEntry.savedAt || new Date().toISOString();
  
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
export function updateQueueItem(id: string, patch: Partial<QueueItem>): QueueItem | null {
  const validatedPatch: any = {};
  
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
    validatedPatch.notes = patch.notes; // Note validation handled separately if needed
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
  if (patch.urgency !== undefined) {
    validatedPatch.urgency = patch.urgency;
  }
  if (patch.note !== undefined) {
    validatedPatch.note = patch.note;
  }
  if (patch.expiryDate !== undefined) {
    validatedPatch.expiryDate = typeof patch.expiryDate === 'number' ? patch.expiryDate : null;
    if (patch.notifiedExpiry === undefined) {
      validatedPatch.notifiedExpiry = false; // Reset notification state if a new expiry is set
    }
  }
  if (patch.notifiedExpiry !== undefined) {
    validatedPatch.notifiedExpiry = Boolean(patch.notifiedExpiry);
  }

  localQueue = localQueue.map((item) => 
    item.id === id ? { ...item, ...validatedPatch, updatedAt: Date.now() } : item
  );
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return localQueue.find(item => item.id === id) || null;
}

export function updateChannelGroup(id: string, group: string) { 
  return updateQueueItem(id, { group }); 
}

/**
 * Remove an item from the queue (soft delete for sync)
 * @param {string} id - Item ID to remove
 * @returns {Array} Queue without the deleted item
 */
export function removeFromQueue(id: string): QueueItem[] {
  // Soft delete for sync engine
  localQueue = localQueue.map(item => 
    item.id === id ? { ...item, deleted: true, updatedAt: Date.now() } : item
  );
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return localQueue.filter(i => !i.deleted);
}

// --- Notes ---
export function getNotes(): any[] { return localNotes; }

export function setNotes(notes: any[]) {
  localNotes = notes;
  storageSet(STORAGE_KEYS.NOTES, notes);
}

/**
 * Add a note with validation
 * @param {Object} note - Note to add
 * @returns {Object|null} The added note or null if invalid
 */
export function addNote(note: any): any | null {
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
export function getSettings(): AppSettings { return localSettings; }

/**
 * Set settings with validation
 * @param {Object} settings - Settings to set
 * @returns {Object} The validated settings
 */
export function setSettings(settings: Partial<AppSettings>): AppSettings {
  const validatedSettings = validateSettings(settings) as AppSettings;
  validatedSettings.updatedAt = Date.now();
  localSettings = validatedSettings;
  storageSet(STORAGE_KEYS.SETTINGS, validatedSettings);
  return validatedSettings;
}

// --- Game State ---
export function getGameStateRaw(): GameState { return localGameState; }
export function getGameState(): GameState { return localGameState; }

export function setGameState(game: GameState) {
  game.updatedAt = Date.now();
  localGameState = game;
  storageSet(STORAGE_KEYS.GAME, game);
}

export function updateGameState(patch: Partial<GameState>): GameState {
  localGameState = { ...localGameState, ...patch, updatedAt: Date.now() };
  localGameState.plant = getPlantStatus(
    localGameState.budgetMinutesTotal - localGameState.budgetMinutesUsed,
    localGameState.budgetMinutesTotal
  );
  storageSet(STORAGE_KEYS.GAME, localGameState);
  return localGameState;
}

// --- Cache ---
export function getScrapeCache(): Record<string, ScrapeData> { return localCache; }

export function setScrapeCache(cache: Record<string, ScrapeData>) {
  localCache = cache;
  storageSet(STORAGE_KEYS.SCRAPE_CACHE, cache);
}

export function getScrapeResult(url: string): ScrapeData | null {
  return localCache[url] || null;
}

/**
 * Cache a scrape result with validation
 * @param {string} url - URL to cache
 * @param {Object} data - Scrape data
 * @returns {Object} The updated cache
 */
export function cacheScrapeResult(url: string, data: Partial<ScrapeData>): Record<string, ScrapeData> {
  const validatedUrl = validateUrl(url);
  if (!validatedUrl) {
    console.warn('[DopaQueue] Attempted to cache invalid URL:', url);
    return localCache;
  }
  
  const validatedData: ScrapeData = {
    url: validatedUrl,
    channel: validateString(data.channel, { maxLength: 100, allowEmpty: true }) || null,
    author: validateString(data.author, { maxLength: 100, allowEmpty: true }) || null,
    authorUrl: validateUrl(data.authorUrl) || null,
    thumbnail: validateUrl(data.thumbnail) || null,
    title: validateString(data.title, { maxLength: 200, allowEmpty: true }) || null,
    transcript: validateString(data.transcript, { maxLength: 50000, allowEmpty: true }) || null,
    genre: validateString(data.genre, { maxLength: 50, allowEmpty: true }) || null,
    scrapedTags: Array.isArray(data.scrapedTags) ? data.scrapedTags.slice(0, 20) : undefined,
    scrapedAt: Date.now(),
  } as ScrapeData; // Coercing because platform/contentType are missing but okay for cache
  
  localCache[validatedUrl] = validatedData;
  
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
  entries.sort((a, b) => (b[1].scrapedAt || 0) - (a[1].scrapedAt || 0));
  
  // Keep only newest MAX_SCRAPE_CACHE_ENTRIES
  localCache = Object.fromEntries(entries.slice(0, MAX_SCRAPE_CACHE_ENTRIES));
}

// Check total cache size in bytes (for monitoring)
export function getScrapeCacheSize(): number {
  return Object.entries(localCache).reduce((sum, [url, data]) => {
    return sum + url.length + (data.transcript ? data.transcript.length : 0);
  }, 0);
}

// Records the channel for a mindless-scroll URL in a lightweight,
// dedicated map that is NOT subject to the scrape-cache LRU eviction.
export function rememberUrlChannel(url: string, channel: string) {
  if (!url || !channel) return;
  
  const validatedUrl = validateUrl(url);
  const validatedChannel = validateString(channel, { maxLength: 100, allowEmpty: false });
  
  if (!validatedUrl || !validatedChannel) return;
  
  if (localUrlChannels[validatedUrl] === validatedChannel) return;
  
  localUrlChannels[validatedUrl] = validatedChannel;
  
  const keys = Object.keys(localUrlChannels);
  if (keys.length > MAX_URL_CHANNEL_ENTRIES) {
    delete localUrlChannels[keys[0]];
  }
  
  storageSet(STORAGE_KEYS.URL_CHANNELS, localUrlChannels);
}

export function getUrlChannel(url: string): string | null {
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
export function getWhitelist(): string[] {
  return [...localWhitelist];
}

/**
 * Save whitelist with validation
 * @param {Array} list - Whitelist to save
 * @returns {Array} The validated whitelist
 */
export function saveWhitelist(list: string[]): string[] {
  localWhitelist = Array.isArray(list)
    ? list.map(w => validateString(w, { maxLength: 100, allowEmpty: false })).filter(Boolean) as string[]
    : [];
  storageSet(STORAGE_KEYS.WHITELIST, localWhitelist);
  return localWhitelist;
}

export function isWhitelistedChannel(channelName: string): boolean {
  if (!channelName) return false;
  const norm = channelName.toLowerCase().trim();
  return localWhitelist.some(c => c && c.toLowerCase().trim() === norm);
}

// --- Pomodoro State Helpers ---
export function getPomodoroState(): PomodoroState {
  return { ...localPomodoro };
}

/**
 * Save pomodoro state with validation
 * @param {Object} state - Pomodoro state to save
 * @returns {Object} The validated pomodoro state
 */
export function savePomodoroState(state: Partial<PomodoroState>): PomodoroState {
  const validatedState: PomodoroState = {
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
export function getAIConfig(): AIConfig {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return localSettings.aiProvider && localSettings.aiApiKey
      ? { provider: localSettings.aiProvider as any, apiKey: localSettings.aiApiKey }
      : { provider: 'local', apiKey: '' };
  }
  return { provider: 'local', apiKey: '' };
}

/**
 * Set AI configuration with validation
 * @param {Object} config - AI configuration
 * @returns {Object} Validated AI configuration
 */
export async function setAIConfig(config: AIConfig): Promise<AIConfig> {
  const validatedConfig = validateAIConfig(config);
  
  const updatedSettings = {
    ...localSettings,
    aiProvider: validatedConfig.provider,
    aiApiKey: validatedConfig.apiKey,
    updatedAt: Date.now(),
  };
  
  localSettings = validateSettings(updatedSettings) as AppSettings;
  storageSet(STORAGE_KEYS.SETTINGS, localSettings);
  
  return validatedConfig;
}

export async function ensureChannelSaved(channelId: string, channelName: string, thumbnailUrl: string): Promise<boolean> { return true; }

