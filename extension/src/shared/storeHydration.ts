import { useDopaQueueStore, DEFAULT_GAME_STATE, DEFAULT_SETTINGS } from './store.js';
import { STORAGE_KEYS } from './constants.js';
import { validateQueueItem } from './validation.js';

/**
 * Hydrate the Zustand store from chrome.storage.local
 * This should be called once during app initialization
 */
export async function hydrateStore(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    useDopaQueueStore.getState().setHydrated(true);
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([
      STORAGE_KEYS.QUEUE,
      STORAGE_KEYS.NOTES,
      STORAGE_KEYS.GAME,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.SCRAPE_CACHE,
      STORAGE_KEYS.WHITELIST,
      STORAGE_KEYS.URL_CHANNELS,
      STORAGE_KEYS.POMODORO,
      STORAGE_KEYS.COLLECTIONS,
    ], (res: any) => {
      if (chrome.runtime.lastError) {
        console.error('hydrateStore error:', chrome.runtime.lastError);
        useDopaQueueStore.getState().setHydrated(true);
        resolve();
        return;
      }

      // Hydrate queue
      const queue = Array.isArray(res[STORAGE_KEYS.QUEUE]) 
        ? res[STORAGE_KEYS.QUEUE].map((item: any) => validateQueueItem(item)).filter(Boolean) as any[]
        : [];
      useDopaQueueStore.getState().setQueue(queue);

      // Hydrate notes
      const notes = Array.isArray(res[STORAGE_KEYS.NOTES]) ? res[STORAGE_KEYS.NOTES] : [];
      useDopaQueueStore.getState().setNotes(notes);

      // Hydrate game state
      const gameState = { ...DEFAULT_GAME_STATE, ...(res[STORAGE_KEYS.GAME] || {}) };
      useDopaQueueStore.getState().setGameState(gameState);

      // Hydrate settings
      const settings = { ...DEFAULT_SETTINGS, ...(res[STORAGE_KEYS.SETTINGS] || {}) };
      useDopaQueueStore.getState().setSettings(settings);

      // Hydrate scrape cache
      const scrapeCache = (res[STORAGE_KEYS.SCRAPE_CACHE] || {}) as Record<string, any>;
      useDopaQueueStore.getState().setScrapeCache(scrapeCache);

      // Hydrate whitelist
      const whitelist = Array.isArray(res[STORAGE_KEYS.WHITELIST]) ? res[STORAGE_KEYS.WHITELIST] : [];
      useDopaQueueStore.getState().setWhitelist(whitelist);

      // Hydrate URL channels
      const urlChannels = (res[STORAGE_KEYS.URL_CHANNELS] || {}) as Record<string, string>;
      useDopaQueueStore.getState().setUrlChannels(urlChannels);

      // Hydrate pomodoro
      const pomodoro = {
        active: false,
        remainingSeconds: 1500,
        label: 'Focus Block',
        ...(res[STORAGE_KEYS.POMODORO] || {}),
      };
      useDopaQueueStore.getState().setPomodoro(pomodoro);

      // Hydrate collections
      const collections = Array.isArray(res[STORAGE_KEYS.COLLECTIONS]) ? res[STORAGE_KEYS.COLLECTIONS] : [];
      useDopaQueueStore.getState().setCollections(collections);

      useDopaQueueStore.getState().setHydrated(true);
      resolve();
    });
  });
}

/**
 * Sync store changes to chrome.storage.local
 * Call this after making changes to persist them
 */
export function syncStoreToStorage(key: string, value: any): void {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  
  chrome.storage.local.set({ [key]: value });
}

/**
 * Subscribe to store changes and sync to storage
 * This replaces the old chrome.storage.onChanged listener pattern
 */
export function setupStorageSync(): void {
  const { subscribe } = useDopaQueueStore;

  subscribe(
    (state) => state.queue,
    (queue) => syncStoreToStorage(STORAGE_KEYS.QUEUE, queue)
  );

  subscribe(
    (state) => state.notes,
    (notes) => syncStoreToStorage(STORAGE_KEYS.NOTES, notes)
  );

  subscribe(
    (state) => state.gameState,
    (gameState) => syncStoreToStorage(STORAGE_KEYS.GAME, gameState)
  );

  subscribe(
    (state) => state.settings,
    (settings) => syncStoreToStorage(STORAGE_KEYS.SETTINGS, settings)
  );

  subscribe(
    (state) => state.scrapeCache,
    (scrapeCache) => syncStoreToStorage(STORAGE_KEYS.SCRAPE_CACHE, scrapeCache)
  );

  subscribe(
    (state) => state.whitelist,
    (whitelist) => syncStoreToStorage(STORAGE_KEYS.WHITELIST, whitelist)
  );

  subscribe(
    (state) => state.urlChannels,
    (urlChannels) => syncStoreToStorage(STORAGE_KEYS.URL_CHANNELS, urlChannels)
  );

  subscribe(
    (state) => state.pomodoro,
    (pomodoro) => syncStoreToStorage(STORAGE_KEYS.POMODORO, pomodoro)
  );

  subscribe(
    (state) => state.collections,
    (collections) => syncStoreToStorage(STORAGE_KEYS.COLLECTIONS, collections)
  );
}