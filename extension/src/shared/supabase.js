import { createClient } from '@supabase/supabase-js';
import { getValidatedConfig, getConfigUnvalidated } from './config.js';

// Get configuration
const config = getConfigUnvalidated();

// Validate we have required Supabase credentials
if (!config.SUPABASE_URL) {
  throw new Error('DopaQueue: SUPABASE_URL is not configured. Please set VITE_SUPABASE_URL in your environment.');
}

if (!config.SUPABASE_ANON_KEY) {
  throw new Error('DopaQueue: SUPABASE_ANON_KEY is not configured. Please set VITE_SUPABASE_ANON_KEY in your environment.');
}

// Use chrome.storage.local as the auth session store so sessions persist correctly
// across extension contexts, falling back to localStorage for non-extension environments.
const storageAdapter =
  typeof chrome !== 'undefined' && chrome?.storage?.local
    ? {
        getItem: (key) =>
          new Promise((resolve) => {
            if (!key) return resolve(null);
            chrome.storage.local.get([key], (res) => {
              if (chrome.runtime.lastError) {
                console.warn('Supabase getItem error:', chrome.runtime.lastError);
                return resolve(null);
              }
              const val = res && res[key] ? res[key] : null;
              if (val === null) {
                resolve(null);
              } else if (typeof val === 'object') {
                resolve(JSON.stringify(val));
              } else {
                resolve(val);
              }
            });
          }),
        setItem: (key, value) =>
          new Promise((resolve) => {
            const valStr = typeof value === 'object' ? JSON.stringify(value) : value;
            chrome.storage.local.set({ [key]: valStr }, resolve);
          }),
        removeItem: (key) =>
          new Promise((resolve) =>
            chrome.storage.local.remove([key], resolve)
          ),
      }
    : globalThis.localStorage;

// Create Supabase client with configuration from environment
const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Export client and config for convenience
export { supabaseClient, config };

export default supabaseClient;
