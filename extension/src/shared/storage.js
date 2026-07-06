// chrome.storage.local helpers shared by background.js, popup.js, and the web app (dashboard).
import {
  STORAGE_KEYS,
  DEFAULT_GAME_STATE,
  DEFAULT_SETTINGS,
  getPlantStatus,
  todayLocalDateString,
} from './constants.js';

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

let initialized = false;

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
      STORAGE_KEYS.SCRAPE_CACHE
      ], (res) => {
      // Check for errors or undefined responses to prevent crashes
      if (chrome.runtime.lastError) {
        console.error('initStorage error:', chrome.runtime.lastError);
      }
      if (!res) res = {}; // Fallback to empty object if get fails

      localQueue = Array.isArray(res[STORAGE_KEYS.QUEUE]) ? res[STORAGE_KEYS.QUEUE] : [];
      localNotes = Array.isArray(res[STORAGE_KEYS.NOTES]) ? res[STORAGE_KEYS.NOTES] : [];
      localGameState = { ...DEFAULT_GAME_STATE, ...(res[STORAGE_KEYS.GAME] || {}) };
      localSettings = { ...DEFAULT_SETTINGS, ...(res[STORAGE_KEYS.SETTINGS] || {}) };
      localCache = res[STORAGE_KEYS.SCRAPE_CACHE] || {};
      
      // Perform daily reset check for game state
      const today = todayLocalDateString();
      if (localGameState.lastResetDate !== today && localGameState.lastReset !== today) {
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
        chrome.storage.local.set({ [STORAGE_KEYS.GAME]: localGameState });
      }

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
        localQueue = changes[STORAGE_KEYS.QUEUE].newValue || [];
        notify(STORAGE_KEYS.QUEUE, localQueue);
      }
      if (changes[STORAGE_KEYS.NOTES]) {
        localNotes = changes[STORAGE_KEYS.NOTES].newValue || [];
        notify(STORAGE_KEYS.NOTES, localNotes);
      }
      if (changes[STORAGE_KEYS.GAME]) {
        localGameState = { ...DEFAULT_GAME_STATE, ...(changes[STORAGE_KEYS.GAME].newValue || {}) };
        notify(STORAGE_KEYS.GAME, localGameState);
      }
      if (changes[STORAGE_KEYS.SETTINGS]) {
        localSettings = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEYS.SETTINGS].newValue || {}) };
        notify(STORAGE_KEYS.SETTINGS, localSettings);
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
export function getSavedVideos() { return localQueue.filter(item => item.type !== 'channel'); }
export function getSavedChannels() { return localQueue.filter(item => item.type === 'channel'); }

export function setQueue(queue) {
  localQueue = queue;
  storageSet(STORAGE_KEYS.QUEUE, queue);
}

export function addToQueue(entry) {
  entry.updatedAt = Date.now();
  localQueue = [...localQueue, entry];
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return localQueue;
}

export function updateQueueItem(id, patch) {
  localQueue = localQueue.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return localQueue;
}

export function updateChannelGroup(id, group) { return updateQueueItem(id, { group }); }

export function removeFromQueue(id) {
  // Soft delete for sync engine
  localQueue = localQueue.map(item => item.id === id ? { ...item, deleted: true, updatedAt: Date.now() } : item);
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  return localQueue.filter(i => !i.deleted);
}

// --- Notes ---
export function getNotes() { return localNotes; }

export function setNotes(notes) {
  localNotes = notes;
  storageSet(STORAGE_KEYS.NOTES, notes);
}

export function addNote(note) {
  note.updatedAt = Date.now();
  localNotes = [...localNotes, note];
  storageSet(STORAGE_KEYS.NOTES, localNotes);
  return localNotes;
}

// --- Settings ---
export function getSettings() { return localSettings; }

export function setSettings(settings) {
  settings.updatedAt = Date.now();
  localSettings = settings;
  storageSet(STORAGE_KEYS.SETTINGS, settings);
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
const MAX_SCRAPE_CACHE_ENTRIES = 20;

export function getScrapeResult(url) {
  return localCache[url] || null;
}

export function cacheScrapeResult(url, data) {
  localCache[url] = { ...data, scrapedAt: Date.now() };
  
  // Enforce MAX_SCRAPE_CACHE_ENTRIES
  const entries = Object.entries(localCache);
  if (entries.length > MAX_SCRAPE_CACHE_ENTRIES) {
    entries.sort((a, b) => b[1].scrapedAt - a[1].scrapedAt);
    localCache = Object.fromEntries(entries.slice(0, MAX_SCRAPE_CACHE_ENTRIES));
  }
  
  storageSet(STORAGE_KEYS.SCRAPE_CACHE, localCache);
  return localCache;
}

// --- Reset ---
export function resetAllData() {
  localQueue = [];
  localNotes = [];
  localGameState = { ...DEFAULT_GAME_STATE, updatedAt: Date.now() };
  localSettings = { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
  
  storageSet(STORAGE_KEYS.QUEUE, localQueue);
  storageSet(STORAGE_KEYS.NOTES, localNotes);
  storageSet(STORAGE_KEYS.GAME, localGameState);
  storageSet(STORAGE_KEYS.SETTINGS, localSettings);
}
