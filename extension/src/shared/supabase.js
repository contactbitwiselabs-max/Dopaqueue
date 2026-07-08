import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://orietzrziyrwnjqljvmv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yaWV0enJ6aXlyd25qcWxqdm12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMzYyMzcsImV4cCI6MjA5ODkxMjIzN30.4HgI_HR0_6Dhl5g4KlmsL4nFOl3vPLMwzikksDXxEIs';

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

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
