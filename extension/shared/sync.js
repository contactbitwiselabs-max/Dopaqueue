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

export async function syncWithCloud() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    throw new Error('Not logged in. Cannot sync with cloud.');
  }

  const userId = session.user.id;

  // 1. Pull remote data
  const [remoteQueueReq, remoteNotesReq, remoteGameReq, remoteSettingsReq] = await Promise.all([
    supabaseClient.from('queue').select('*').eq('user_id', userId),
    supabaseClient.from('notes').select('*').eq('user_id', userId),
    supabaseClient.from('game_state').select('*').eq('user_id', userId).maybeSingle(),
    supabaseClient.from('settings').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (remoteQueueReq.error) throw remoteQueueReq.error;
  if (remoteNotesReq.error) throw remoteNotesReq.error;
  if (remoteGameReq.error) throw remoteGameReq.error;
  if (remoteSettingsReq.error) throw remoteSettingsReq.error;

  const remoteQueue = remoteQueueReq.data || [];
  const remoteNotes = remoteNotesReq.data || [];
  const remoteGame = remoteGameReq.data;
  const remoteSettings = remoteSettingsReq.data;

  // 2. Get local data
  const localQueue = getQueue();
  const localNotes = getNotes();
  const localGame = getGameState();
  const localSettings = getSettings();

  // 3. Merge
  const mergedQueue = mergeArrays(localQueue, remoteQueue);
  const mergedNotes = mergeArrays(localNotes, remoteNotes);
  const mergedGame = mergeObjects(localGame, remoteGame);
  const mergedSettings = mergeObjects(localSettings, remoteSettings);

  // 4. Save merged state locally
  setQueue(mergedQueue);
  setNotes(mergedNotes);
  setGameState(mergedGame);
  setSettings(mergedSettings);

  // To push to Supabase, we upsert the merged data (ensuring user_id is set)
  const toUpsertQueue = mergedQueue.map(i => ({ ...i, user_id: userId }));
  const toUpsertNotes = mergedNotes.map(i => ({ ...i, user_id: userId }));
  const toUpsertGame = { ...mergedGame, user_id: userId };
  const toUpsertSettings = { ...mergedSettings, user_id: userId };

  const pushPromises = [];
  if (toUpsertQueue.length > 0) pushPromises.push(supabaseClient.from('queue').upsert(toUpsertQueue));
  if (toUpsertNotes.length > 0) pushPromises.push(supabaseClient.from('notes').upsert(toUpsertNotes));
  pushPromises.push(supabaseClient.from('game_state').upsert(toUpsertGame));
  pushPromises.push(supabaseClient.from('settings').upsert(toUpsertSettings));

  await Promise.all(pushPromises);

  return {
    queue: mergedQueue,
    notes: mergedNotes,
    game: mergedGame,
    settings: mergedSettings
  };
}
