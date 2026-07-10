// @ts-nocheck
// DopaQueue Auth Module
// Handles Supabase authentication (Google, Email)
// Stores session in chrome.storage for persistence across contexts

import { supabaseClient } from './supabase';
import { Session, User } from '@supabase/supabase-js';

const STORAGE_KEY = 'dq_auth_session';
const STORAGE_KEY_USER = 'dq_auth_user';

export async function getAuthSession(): Promise<Session | null> {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('DopaQueue: auth.getSession error', error);
    return null;
  }
  return data?.session || null;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('session missing')) {
      return null;
    }
    console.error('DopaQueue: auth.getUser error', error);
    return null;
  }
  return data?.user || null;
}

export async function signInWithGoogle() {
  if (typeof chrome !== 'undefined' && chrome.identity) {
    const redirectUrl = chrome.identity.getRedirectURL();
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No redirect URL returned from Supabase');

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: data.url,
          interactive: true,
        },
        async (callbackUrl) => {
          if (chrome.runtime.lastError || !callbackUrl) {
            console.error('Auth flow error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError || new Error('Auth flow failed'));
            return;
          }

          try {
            const urlObj = new URL(callbackUrl);
            const hashParams = new URLSearchParams(urlObj.hash.substring(1));
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');

            if (access_token && refresh_token) {
              const { data: sessionData, error: sessionError } = await supabaseClient.auth.setSession({
                access_token,
                refresh_token,
              });
              if (sessionError) throw sessionError;
              resolve(sessionData);
            } else {
              throw new Error('No access token found in auth callback');
            }
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  } else {
    // Fallback for non-extension environment
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('dashboard.html') : undefined,
      },
    });
    if (error) throw error;
    return data;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
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

export async function updateUser(attributes: any) {
  const { data, error } = await supabaseClient.auth.updateUser(attributes);
  if (error) throw error;
  return data;
}

// Store session + user in chrome.storage for retrieval in different contexts
export async function persistAuthState(): Promise<{ session: Session | null; user: User | null }> {
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

export async function getPersistedAuthState(): Promise<{ session: Session | null; user: User | null }> {
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

export function isLoggedIn(user: User | null): boolean {
  return user && user.id ? true : false;
}

export function getUserEmail(user: User | null): string | null {
  return user?.email || null;
}

export function getUserName(user: User | null): string {
  return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
}

