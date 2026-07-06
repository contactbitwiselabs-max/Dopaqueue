// chrome.storage.local helpers shared by background.js, popup.js, and the web app (dashboard).
import {
  STORAGE_KEYS,
  DEFAULT_GAME_STATE,
  DEFAULT_SETTINGS,
  getPlantStatus,
  todayLocalDateString,
} from '../extension/shared/constants.js';

// --- Pub/Sub using chrome.storage.onChanged ---
const listeners = new Map(); // key -> Set<callback>

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}

if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      for (const key in changes) {
        const subs = listeners.get(key);
        if (subs) {
          subs.forEach(cb => cb(changes[key].newValue));
        }
      }
    }
  });
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

// --- Queue ---
export async function getQueue() {
  const { [STORAGE_KEYS.QUEUE]: queue } = await storageGet(STORAGE_KEYS.QUEUE);
  return Array.isArray(queue) ? queue : [];
}

export async function getSavedVideos() {
  const q = await getQueue();
  return q.filter(item => item.type !== 'channel');
}

export async function getSavedChannels() {
  const q = await getQueue();
  return q.filter(item => item.type === 'channel');
}

export async function setQueue(queue) {
  await storageSet({ [STORAGE_KEYS.QUEUE]: queue });
}

export async function addToQueue(entry) {
  const queue = await getQueue();
  entry.updatedAt = Date.now();
  queue.push(entry);
  await setQueue(queue);
  return queue;
}

export async function updateQueueItem(id, patch) {
  const queue = await getQueue();
  const next = queue.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item));
  await setQueue(next);
  return next;
}

export function updateChannelGroup(id, group) {
  return updateQueueItem(id, { group });
}

export async function removeFromQueue(id) {
  const queue = await getQueue();
  const next = queue.filter((item) => item.id !== id);
  // We don't mark as updated since we're deleting, but for sync we might need tombstones.
  // For simplicity, we just delete. If we sync with Supabase and it exists there, it will re-download.
  // Wait, if we want deletion to sync, we should mark as deleted (soft delete).
  // Let's do a soft delete for the queue.
  const softDeleted = queue.map(item => item.id === id ? { ...item, deleted: true, updatedAt: Date.now() } : item);
  await setQueue(softDeleted);
  return softDeleted.filter(i => !i.deleted);
}

// --- Notes ---
export async function getNotes() {
  const { [STORAGE_KEYS.NOTES]: notes } = await storageGet(STORAGE_KEYS.NOTES);
  return Array.isArray(notes) ? notes : [];
}

export async function addNote(note) {
  const notes = await getNotes();
  note.updatedAt = Date.now();
  notes.push(note);
  await storageSet({ [STORAGE_KEYS.NOTES]: notes });
  return notes;
}

// --- Settings ---
export async function getSettings() {
  const { [STORAGE_KEYS.SETTINGS]: settings } = await storageGet(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function setSettings(settings) {
  settings.updatedAt = Date.now();
  await storageSet({ [STORAGE_KEYS.SETTINGS]: settings });
}

// --- Game State ---
export async function getGameStateRaw() {
  const { [STORAGE_KEYS.GAME]: game } = await storageGet(STORAGE_KEYS.GAME);
  return { ...DEFAULT_GAME_STATE, ...(game || {}) };
}

export async function getGameState() {
  const [stored, settings] = await Promise.all([
    getGameStateRaw(),
    getSettings(),
  ]);

  let game = stored;
  const today = todayLocalDateString();

  if (game.lastResetDate !== today && game.lastReset !== today) {
    game = {
      ...game,
      budgetMinutesUsed: 0,
      budgetMinutesTotal: settings.dailyBudgetMinutes,
      notifiedZeroToday: false,
      lastResetDate: today,
      lastReset: today,
    };
    game.plant = getPlantStatus(
      game.budgetMinutesTotal - game.budgetMinutesUsed,
      game.budgetMinutesTotal
    );
    await setGameState(game);
  }

  return game;
}

export async function setGameState(game) {
  game.updatedAt = Date.now();
  await storageSet({ [STORAGE_KEYS.GAME]: game });
}

export async function updateGameState(patch) {
  const current = await getGameState();
  const next = { ...current, ...patch, updatedAt: Date.now() };
  next.plant = getPlantStatus(
    next.budgetMinutesTotal - next.budgetMinutesUsed,
    next.budgetMinutesTotal
  );
  await setGameState(next);
  return next;
}

// --- Cache ---
const MAX_SCRAPE_CACHE_ENTRIES = 20;

export async function getScrapeCache() {
  const { [STORAGE_KEYS.SCRAPE_CACHE]: cache } = await storageGet(STORAGE_KEYS.SCRAPE_CACHE);
  return cache && typeof cache === 'object' ? cache : {};
}

export async function cacheScrapeResult(url, data) {
  const cache = await getScrapeCache();
  cache[url] = { ...data, scrapedAt: Date.now() };

  const entries = Object.entries(cache);
  if (entries.length > MAX_SCRAPE_CACHE_ENTRIES) {
    entries.sort((a, b) => b[1].scrapedAt - a[1].scrapedAt);
    const trimmed = Object.fromEntries(entries.slice(0, MAX_SCRAPE_CACHE_ENTRIES));
    await storageSet({ [STORAGE_KEYS.SCRAPE_CACHE]: trimmed });
    return trimmed;
  }

  await storageSet({ [STORAGE_KEYS.SCRAPE_CACHE]: cache });
  return cache;
}

export async function getScrapeResult(url) {
  const cache = await getScrapeCache();
  return cache[url] || null;
}

// --- Reset ---
export async function resetAllData() {
  await storageSet({
    [STORAGE_KEYS.QUEUE]: [],
    [STORAGE_KEYS.NOTES]: [],
    [STORAGE_KEYS.GAME]: { ...DEFAULT_GAME_STATE, updatedAt: Date.now() },
    [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, updatedAt: Date.now() }
  });
}
