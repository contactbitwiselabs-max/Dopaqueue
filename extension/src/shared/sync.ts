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
function mergeArrays<T extends { id: string; updatedAt?: number }>(localArray: T[], remoteArray: T[]): T[] {
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
function mergeObjects<T extends { updatedAt?: number }>(localObj: T | null, remoteObj: T | null): T | null {
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
function mergeScrapeCache(localCache: Record<string, ScrapeData>, remoteRows: any[]): Record<string, ScrapeData> {
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
