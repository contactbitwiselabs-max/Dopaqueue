import {
  getQueue, getNotes, getGameState, getSettings, getScrapeCache,
  setQueue, setNotes, setGameState, setSettings, setScrapeCache,
} from './storage.js';
import { supabaseClient } from './supabase.js';
import { MAX_SCRAPE_CACHE_ENTRIES } from './constants.js';

/**
 * Merges a local array of items and a remote array of items based on `updatedAt`.
 * Returns the merged array.
 */
function mergeArrays(localArray, remoteArray) {
  const map = new Map();
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
function mergeObjects(localObj, remoteObj) {
  if (!remoteObj) return localObj;
  if (!localObj) return remoteObj;
  
  const localTime = localObj.updatedAt || 0;
  const remoteTime = remoteObj.updatedAt || 0;
  
  return localTime > remoteTime ? localObj : remoteObj;
}

// Pulls, merges, and pushes a single array-shaped table (queue/notes).
// Local state is saved as soon as the merge is computed, *before* the
// push to Supabase — so a push failure still leaves the merged local
// data intact instead of losing it.
async function syncArrayTable(table, userId, getLocal, setLocal) {
  const { data: remote, error: pullError } = await supabaseClient
    .from(table)
    .select('*')
    .eq('user_id', userId);
  if (pullError) throw pullError;

  const merged = mergeArrays(getLocal(), remote || []);
  setLocal(merged);

  const toUpsert = merged.map((i) => ({ ...i, user_id: userId }));
  if (toUpsert.length > 0) {
    const { error: pushError } = await supabaseClient.from(table).upsert(toUpsert);
    if (pushError) throw pushError;
  }

  return merged;
}

// Same as syncArrayTable but for the single-row object tables
// (game_state/settings).
async function syncObjectTable(table, userId, getLocal, setLocal) {
  const { data: remote, error: pullError } = await supabaseClient
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (pullError) throw pullError;

  const merged = mergeObjects(getLocal(), remote);
  setLocal(merged);

  const { error: pushError } = await supabaseClient
    .from(table)
    .upsert({ ...merged, user_id: userId });
  if (pushError) throw pushError;

  return merged;
}

// Merges the local scrape cache (map of url -> {genre, channel,
// transcript, scrapedAt}) with remote rows keyed by url, keeping
// whichever side scraped more recently per URL. Trims to the same
// MAX_SCRAPE_CACHE_ENTRIES cap storage.js enforces on local writes,
// so a sync pull can't grow the cache past that limit.
function mergeScrapeCache(localCache, remoteRows) {
  const merged = { ...localCache };
  for (const row of remoteRows || []) {
    const existing = merged[row.url];
    if (!existing || (row.scrapedAt || 0) > (existing.scrapedAt || 0)) {
      merged[row.url] = {
        genre: row.genre,
        channel: row.channel,
        transcript: row.transcript,
        scrapedAt: row.scrapedAt,
      };
    }
  }

  const entries = Object.entries(merged).sort(
    (a, b) => (b[1].scrapedAt || 0) - (a[1].scrapedAt || 0)
  );
  return Object.fromEntries(entries.slice(0, MAX_SCRAPE_CACHE_ENTRIES));
}

// Same pull -> merge -> save-local -> push shape as syncArrayTable/
// syncObjectTable, but for the scrape cache, which is a url-keyed map
// rather than an id-keyed array or a single row.
async function syncScrapeCache(userId, getLocal, setLocal) {
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

export async function syncWithCloud() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    throw new Error('Not logged in. Cannot sync with cloud.');
  }

  const userId = session.user.id;

  // Each table syncs independently so one failure (e.g. a single bad
  // row, an RLS hiccup on one table) doesn't block the others — local
  // state for every successful table is still saved even if some fail.
  const jobs = [
    { key: 'queue', run: () => syncArrayTable('queue', userId, getQueue, setQueue) },
    { key: 'notes', run: () => syncArrayTable('notes', userId, getNotes, setNotes) },
    { key: 'game', run: () => syncObjectTable('game_state', userId, getGameState, setGameState) },
    { key: 'settings', run: () => syncObjectTable('settings', userId, getSettings, setSettings) },
    { key: 'scrapeCache', run: () => syncScrapeCache(userId, getScrapeCache, setScrapeCache) },
  ];

  const settled = await Promise.allSettled(jobs.map((job) => job.run()));

  const result = {};
  const failures = {};
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
    const err = new Error(`Sync failed for: ${failedKeys.join(', ')}`);
    err.partial = result;
    err.failures = failures;
    throw err;
  }

  return result;
}
