import { getQueue, getNotes, getGameState, getSettings, setQueue, setNotes, setGameState, setSettings } from './storage.js';
import { supabaseClient } from './supabase.js';

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
