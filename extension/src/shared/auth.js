// DopaQueue Auth Module
// Handles Supabase authentication (Google, Email)
// Stores session in chrome.storage for persistence across contexts

import { supabaseClient } from './supabase.js';

const STORAGE_KEY = 'dq_auth_session';
const STORAGE_KEY_USER = 'dq_auth_user';

export async function getAuthSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('DopaQueue: auth.getSession error', error);
    return null;
  }
  return data?.session || null;
}

export async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error('DopaQueue: auth.getUser error', error);
    return null;
  }
  return data?.user || null;
}

export async function signInWithGoogle() {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: chrome.runtime.getURL('dashboard.html'),
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: chrome.runtime.getURL('dashboard.html'),
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

export async function updateUser(attributes) {
  const { data, error } = await supabaseClient.auth.updateUser(attributes);
  if (error) throw error;
  return data;
}

// Store session + user in chrome.storage for retrieval in different contexts
export async function persistAuthState() {
  try {
    const session = await getAuthSession();
    const user = await getCurrentUser();

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({
        [STORAGE_KEY]: session,
        [STORAGE_KEY_USER]: user,
      });
    }

    return { session, user };
  } catch (err) {
    console.error('DopaQueue: persistAuthState error', err);
    return { session: null, user: null };
  }
}

export async function getPersistedAuthState() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve({ session: null, user: null });
      return;
    }

    chrome.storage.local.get([STORAGE_KEY, STORAGE_KEY_USER], (res) => {
      if (chrome.runtime.lastError) {
        console.warn('DopaQueue: getPersistedAuthState error', chrome.runtime.lastError);
        resolve({ session: null, user: null });
        return;
      }
      resolve({
        session: res[STORAGE_KEY] || null,
        user: res[STORAGE_KEY_USER] || null,
      });
    });
  });
}

// Listen for auth changes and persist state
if (typeof chrome !== 'undefined' && chrome.storage) {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('DopaQueue: auth state changed', event);
    await persistAuthState();
  });
}

export function isLoggedIn(user) {
  return user && user.id ? true : false;
}

export function getUserEmail(user) {
  return user?.email || null;
}

export function getUserName(user) {
  return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
}
