import {
  getQueue, getNotes, getGameState, getSettings, getScrapeCache,
  setQueue, setNotes, setGameState, setSettings, setScrapeCache,
} from './storage';
import { supabaseClient } from './supabase';
import { MAX_SCRAPE_CACHE_ENTRIES } from './constants';
import { QueueItem, GameState, AppSettings, ScrapeData } from '../types';

/**
 * Merges a local array of items and a remote array of items based on `updatedAt`.
 * Returns the merged array.
 */
export function mergeArrays<T extends { id: string; updatedAt?: number }>(localArray: T[], remoteArray: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of remoteArray) {
    map.set(item.id, item);
  }
  for (const item of localArray) {
    const existing = map.get(item.id);
    if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Merges two objects based on `updatedAt`.
 */
export function mergeObjects<T extends { updatedAt?: number }>(localObj: T | null, remoteObj: T | null): T | null {
  if (!remoteObj) return localObj;
  if (!localObj) return remoteObj;
  
  const localTime = localObj.updatedAt || 0;
  const remoteTime = remoteObj.updatedAt || 0;
  
  return localTime > remoteTime ? localObj : remoteObj;
}

// Pulls, merges, and pushes a single array-shaped table (queue/notes).
async function syncArrayTable<T extends { id: string; updatedAt?: number }>(
  table: string, 
  userId: string, 
  getLocal: () => T[], 
  setLocal: (data: T[]) => void
): Promise<T[]> {
  const { data: remote, error: pullError } = await supabaseClient
    .from(table)
    .select('*')
    .eq('user_id', userId);
  if (pullError) throw pullError;

  const merged = mergeArrays(getLocal(), (remote as T[]) || []);
  setLocal(merged);

  const toUpsert = merged.map((i) => ({ ...i, user_id: userId }));
  if (toUpsert.length > 0) {
    const { error: pushError } = await supabaseClient.from(table).upsert(toUpsert);
    if (pushError) throw pushError;
  }

  return merged;
}

// Same as syncArrayTable but for the single-row object tables
async function syncObjectTable<T extends { updatedAt?: number }>(
  table: string, 
  userId: string, 
  getLocal: () => T, 
  setLocal: (data: T) => void
): Promise<T> {
  const { data: remote, error: pullError } = await supabaseClient
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (pullError) throw pullError;

  const localObj = getLocal();
  const merged = mergeObjects(localObj, remote as T) || localObj;
  setLocal(merged);

  const { error: pushError } = await supabaseClient
    .from(table)
    .upsert({ ...merged, user_id: userId });
  if (pushError) throw pushError;

  return merged;
}

// Merges the local scrape cache
export function mergeScrapeCache(localCache: Record<string, ScrapeData>, remoteRows: any[]): Record<string, ScrapeData> {
  const merged = { ...localCache };
  for (const row of remoteRows || []) {
    const existing = merged[row.url];
    if (!existing || (row.scrapedAt || 0) > (existing.scrapedAt || 0)) {
      merged[row.url] = {
        url: row.url,
        genre: row.genre,
        channel: row.channel,
        transcript: row.transcript,
        scrapedAt: row.scrapedAt,
        author: existing?.author || undefined,
        authorUrl: existing?.authorUrl || undefined,
        thumbnail: existing?.thumbnail || undefined,
        title: existing?.title || undefined
      };
    }
  }

  const entries = Object.entries(merged).sort(
    (a, b) => (b[1].scrapedAt || 0) - (a[1].scrapedAt || 0)
  );
  return Object.fromEntries(entries.slice(0, MAX_SCRAPE_CACHE_ENTRIES));
}

// Same pull -> merge -> save-local -> push shape as syncArrayTable
async function syncScrapeCache(
  userId: string, 
  getLocal: () => Record<string, ScrapeData>, 
  setLocal: (data: Record<string, ScrapeData>) => void
): Promise<Record<string, ScrapeData>> {
  const { data: remote, error: pullError } = await supabaseClient
    .from('scrape_cache')
    .select('*')
    .eq('user_id', userId);
  if (pullError) throw pullError;

  const merged = mergeScrapeCache(getLocal(), remote || []);
  setLocal(merged);

  const toUpsert = Object.entries(merged).map(([url, data]) => ({
    user_id: userId,
    url,
    genre: data.genre ?? null,
    channel: data.channel ?? null,
    transcript: data.transcript ?? null,
    scrapedAt: data.scrapedAt ?? null,
  }));
  if (toUpsert.length > 0) {
    const { error: pushError } = await supabaseClient
      .from('scrape_cache')
      .upsert(toUpsert, { onConflict: 'user_id,url' });
    if (pushError) throw pushError;
  }

  return merged;
}

export interface SyncError extends Error {
  partial?: any;
  failures?: any;
}

export async function syncWithCloud() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    throw new Error('Not logged in. Cannot sync with cloud.');
  }

  const userId = session.user.id;

  // B21: Flush any pending sync queue items before the full sync starts
  // so they don't get left behind (e.g. user was offline, now online).
  try {
    const flushed = await flushPendingSyncQueue();
    if (flushed.success > 0) {
      console.info('[DopaQueue] Flushed', flushed.success, 'pending sync items before full sync');
    }
  } catch (e) {
    console.warn('[DopaQueue] flushPendingSyncQueue failed:', e);
  }

  const jobs = [
    { key: 'queue', run: () => syncArrayTable('queue', userId, getQueue, setQueue) },
    { key: 'notes', run: () => syncArrayTable('notes', userId, getNotes, setNotes) },
    { key: 'game', run: () => syncObjectTable('game_state', userId, getGameState, setGameState) },
    { key: 'settings', run: () => syncObjectTable('settings', userId, getSettings, setSettings) },
    { key: 'scrapeCache', run: () => syncScrapeCache(userId, getScrapeCache, setScrapeCache) },
  ];

  const settled = await Promise.allSettled(jobs.map((job) => job.run()));

  const result: any = {};
  const failures: any = {};
  settled.forEach((outcome, i) => {
    const { key } = jobs[i];
    if (outcome.status === 'fulfilled') {
      result[key] = outcome.value;
    } else {
      failures[key] = outcome.reason;
      console.error(`DopaQueue: sync failed for "${key}"`, outcome.reason);
    }
  });

  const failedKeys = Object.keys(failures);
  if (failedKeys.length > 0) {
    const err = new Error(`Sync failed for: ${failedKeys.join(', ')}`) as SyncError;
    err.partial = result;
    err.failures = failures;
    throw err;
  }

  return result;
}

/**
 * Always-on sync: upserts a single QueueItem's metadata to the Supabase `queue` table.
 * Blobs (screenshots, article content) are NEVER synced — they remain in local IndexedDB only.
 * Called from background.ts SAVE_ITEM handler when autoSyncEnabled = true and user is logged in.
 * B21: If upsert fails for any reason (offline, auth, rate-limit), the item is queued
 * for later retry via flushPendingSyncQueue(), preventing silent data loss.
 */
export async function autoSyncItem(item: QueueItem): Promise<void> {
  try {
    await _autoSyncItemInternal(item);
  } catch (e) {
    // B21: Silent auto-sync failed — queue for a later retry
    console.warn('[DopaQueue] autoSyncItem failed (queued for retry):', e);
    try {
      await queueForSync(item);
    } catch {
      // If even queueing fails, just drop — save still succeeded locally.
    }
  }
}
// If autoSyncItem fails due to network (offline, auth token expired, rate-limit),
// enqueue the item for later retry. This prevents silent data loss.
const SYNC_QUEUE_KEY = 'dq_pending_sync_items_v1';

/**
 * Get the current pending sync queue from chrome.storage.local.
 * Returns a Promise that resolves to the array of pending items.
 */
export async function getPendingSyncQueue(): Promise<QueueItem[]> {
  if (typeof chrome === 'undefined' || !chrome.storage) return [];
  return new Promise((resolve) => {
    chrome.storage.local.get([SYNC_QUEUE_KEY], (res) => {
      resolve(Array.isArray(res[SYNC_QUEUE_KEY]) ? res[SYNC_QUEUE_KEY] : []);
    });
  });
}

/**
 * Append items to the pending sync queue.
 */
async function queueForSync(item: QueueItem): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  const queue = await getPendingSyncQueue();
  // Dedupe by id
  const filtered = queue.filter((i: QueueItem) => i.id !== item.id);
  filtered.push(item);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SYNC_QUEUE_KEY]: filtered }, resolve);
  });
}

/**
 * Remove an item from the pending sync queue once it's successfully synced.
 */
async function dequeueSyncedItem(id: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  const queue = await getPendingSyncQueue();
  const filtered = queue.filter((i: QueueItem) => i.id !== id);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SYNC_QUEUE_KEY]: filtered }, resolve);
  });
}

/**
 * Attempt to flush the pending sync queue.
 * Called after successful login or periodically when online.
 */
export async function flushPendingSyncQueue(): Promise<{ success: number; failed: number }> {
  const queue = await getPendingSyncQueue();
  let success = 0, failed = 0;
  for (const item of queue) {
    try {
      await _autoSyncItemInternal(item);
      await dequeueSyncedItem(item.id);
      success++;
    } catch {
      failed++;
    }
  }
  return { success, failed };
}

/**
 * Implementation: actual Supabase upsert with no retry logic.
 * Used by flushPendingSyncQueue to avoid infinite recursion.
 */
async function _autoSyncItemInternal(item: QueueItem): Promise<void> {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.user?.id) return;

  const safeItem = { ...item, blobId: undefined };
  const { error } = await supabaseClient
    .from('queue')
    .upsert({ ...safeItem, user_id: session.user.id }, { onConflict: 'id' });

  if (error) {
    throw new Error(`autoSyncItem upsert failed: ${error.message}`);
  }
}
