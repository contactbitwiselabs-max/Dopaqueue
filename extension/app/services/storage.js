// Supabase real-time storage wrapper + tiny pub-sub
import { STORAGE_KEYS, DEFAULT_GAME_STATE, DEFAULT_SETTINGS } from './constants.js';
import { supabaseClient } from '../shared/supabase.js';

const listeners = new Map(); // key -> Set<callback>

function notify(key) {
  const subs = listeners.get(key);
  if (!subs) return;
  subs.forEach((cb) => cb());
}

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}

// In-memory state for synchronous reads by the UI
let localQueue = [];
let localNotes = [];
let localGameState = { ...DEFAULT_GAME_STATE };
let localSettings = { ...DEFAULT_SETTINGS };

// Load initial data
async function initStorage() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return; // not logged in

  const [queueRes, notesRes, gameRes] = await Promise.all([
    supabaseClient.from('queue').select('*').eq('user_id', user.id).order('savedAt', { ascending: false }),
    supabaseClient.from('notes').select('*').eq('user_id', user.id).order('createdAt', { ascending: false }),
    supabaseClient.from('game_state').select('*').eq('user_id', user.id).single()
  ]);

  if (queueRes.data) localQueue = queueRes.data;
  if (notesRes.data) localNotes = notesRes.data;
  if (gameRes.data) localGameState = { ...DEFAULT_GAME_STATE, ...gameRes.data };

  // Settings can remain in localStorage since they are device-specific (like budget preference)
  // or we can load them from game_state. We'll leave them in localStorage for now.
  localSettings = { ...DEFAULT_SETTINGS, ...readJSON(STORAGE_KEYS.SETTINGS, {}) };

  notify(STORAGE_KEYS.QUEUE);
  notify(STORAGE_KEYS.NOTES);
  notify(STORAGE_KEYS.GAME);

  // Subscribe to real-time changes
  supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `user_id=eq.${user.id}` }, (payload) => {
      // Re-fetch or apply patch. Re-fetch is easiest and safest.
      supabaseClient.from('queue').select('*').eq('user_id', user.id).order('savedAt', { ascending: false }).then(res => {
        localQueue = res.data || [];
        notify(STORAGE_KEYS.QUEUE);
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: `user_id=eq.${user.id}` }, (payload) => {
      supabaseClient.from('game_state').select('*').eq('user_id', user.id).single().then(res => {
        if (res.data) localGameState = { ...DEFAULT_GAME_STATE, ...res.data };
        notify(STORAGE_KEYS.GAME);
      });
    })
    .subscribe();
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    initStorage();
  } else if (event === 'SIGNED_OUT') {
    localQueue = [];
    localNotes = [];
    localGameState = { ...DEFAULT_GAME_STATE };
  }
});

// Settings remain in localStorage since they are device-specific UI prefs
function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  notify(key);
}

// --- Queue -----------------------------------------------------------
export function getQueue() { return localQueue; }
export function getSavedVideos() { return localQueue.filter(item => item.type !== 'channel'); }
export function getSavedChannels() { return localQueue.filter(item => item.type === 'channel'); }

export async function addToQueue(entry) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return localQueue;
  
  entry.user_id = user.id;
  // Optimistic update
  localQueue = [entry, ...localQueue];
  notify(STORAGE_KEYS.QUEUE);

  await supabaseClient.from('queue').insert(entry);
  return localQueue;
}

export async function updateQueueItem(id, patch) {
  localQueue = localQueue.map((item) => (item.id === id ? { ...item, ...patch } : item));
  notify(STORAGE_KEYS.QUEUE);

  await supabaseClient.from('queue').update(patch).eq('id', id);
  return localQueue;
}

export function updateChannelGroup(id, group) { return updateQueueItem(id, { group }); }

export async function removeFromQueue(id) {
  localQueue = localQueue.filter((item) => item.id !== id);
  notify(STORAGE_KEYS.QUEUE);

  await supabaseClient.from('queue').delete().eq('id', id);
  return localQueue;
}

// --- Notes -------------------------------------------------------------
export function getNotes() { return localNotes; }
export async function addNote(note) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return localNotes;

  note.user_id = user.id;
  localNotes = [note, ...localNotes];
  notify(STORAGE_KEYS.NOTES);

  await supabaseClient.from('notes').insert(note);
  return localNotes;
}

// --- Game state ---------------------------------------------------------
export function getGameStateRaw() { return localGameState; }
export async function setGameState(game) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  localGameState = { ...localGameState, ...game };
  notify(STORAGE_KEYS.GAME);

  await supabaseClient.from('game_state').upsert({ user_id: user.id, ...localGameState });
}

// --- Settings ------------------------------------------------------------
export function getSettings() { return localSettings; }
export function setSettings(settings) {
  localSettings = settings;
  writeJSON(STORAGE_KEYS.SETTINGS, settings);
}

// --- Reset all -----------------------------------------------------------
export async function resetAllData() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    await supabaseClient.from('queue').delete().eq('user_id', user.id);
    await supabaseClient.from('notes').delete().eq('user_id', user.id);
    await supabaseClient.from('game_state').delete().eq('user_id', user.id);
  }
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
    notify(key);
  });
  localQueue = [];
  localNotes = [];
  localGameState = { ...DEFAULT_GAME_STATE };
  notify(STORAGE_KEYS.QUEUE);
  notify(STORAGE_KEYS.NOTES);
  notify(STORAGE_KEYS.GAME);
}

// Trigger initial load if already logged in
initStorage();
