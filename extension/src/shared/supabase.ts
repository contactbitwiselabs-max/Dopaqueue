import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfigUnvalidated } from './config';

// Get configuration
const config = getConfigUnvalidated();

// Validate we have required Supabase credentials
if (!config.SUPABASE_URL) {
  console.warn('DopaQueue: SUPABASE_URL is not configured. Falling back to dummy value.');
  config.SUPABASE_URL = 'https://dummy-project.supabase.co';
}

if (!config.SUPABASE_ANON_KEY) {
  console.warn('DopaQueue: SUPABASE_ANON_KEY is not configured. Falling back to dummy value.');
  config.SUPABASE_ANON_KEY = 'dummy-key';
}

// Use chrome.storage.local as the auth session store so sessions persist correctly
// across extension contexts, falling back to localStorage for non-extension environments.
const storageAdapter =
  typeof chrome !== 'undefined' && chrome?.storage?.local
    ? {
        getItem: (key: string): Promise<string | null> =>
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
                resolve(String(val));
              }
            });
          }),
        setItem: (key: string, value: string): Promise<void> =>
          new Promise((resolve) => {
            const valStr = typeof value === 'object' ? JSON.stringify(value) : value;
            chrome.storage.local.set({ [key]: valStr }, resolve);
          }),
        removeItem: (key: string): Promise<void> =>
          new Promise((resolve) =>
            chrome.storage.local.remove([key], resolve)
          ),
      }
    : globalThis.localStorage;

// Create Supabase client with configuration from environment
const supabaseClient: SupabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter as any, // Supabase types are picky but this adapter satisfies the runtime
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Export client and config for convenience
export { supabaseClient, config };

export default supabaseClient;
