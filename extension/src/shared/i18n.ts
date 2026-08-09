import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { esMessages } from './locales.js';
import { frMessages } from './locales.js';
import { deMessages } from './locales.js';
import { jaMessages } from './locales.js';
import { zhMessages } from './locales.js';
import { ptMessages } from './locales.js';

interface I18nState {
  locale: string;
  messages: Record<string, Record<string, string>>;
  setLocale: (locale: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
  addMessages: (locale: string, messages: Record<string, string>) => void;
}

// Default English messages
const defaultMessages: Record<string, string> = {
  'app.name': 'DopaQueue',
  'app.tagline': 'Save videos intentionally, watch them distraction-free',
  'save.button': 'Save to Queue',
  'save.already': 'Already Saved',
  'save.saving': 'Saving...',
  'save.error': 'Failed to save',
  'settings.title': 'Settings',
  'settings.sync': 'Auto-sync to cloud',
  'settings.theme': 'Theme',
  'settings.budget': 'Daily budget (minutes)',
  'dashboard.title': 'Dashboard',
  'dashboard.videos': 'Saved Videos',
  'dashboard.channels': 'Channels',
  'dashboard.analysis': 'Analysis',
  'dashboard.settings': 'Settings',
  'dashboard.circles': 'Collections',
  'plant.thriving': 'Thriving',
  'plant.okay': 'Okay',
  'plant.wilting': 'Wilting',
  'plant.dead': 'Needs care',
  'quota.used': 'Used',
  'quota.remaining': 'Remaining',
  'quota.total': 'Total',
  'auth.signin': 'Sign in',
  'auth.signup': 'Sign up',
  'auth.google': 'Continue with Google',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'error.generic': 'Something went wrong',
  'error.network': 'Network error',
  'error.auth': 'Authentication required',
  'confirm.delete': 'Are you sure?',
  'action.delete': 'Delete',
  'action.cancel': 'Cancel',
  'action.save': 'Save',
  'action.edit': 'Edit',
  'action.share': 'Share',
  'action.export': 'Export',
  'action.add': 'Add',
  'action.create': 'Create',
  'action.signout': 'Sign Out',
  'action.sync': 'to sync',
  'toast.saved': 'Saved successfully',
  'toast.synced': 'Synced with cloud',
  'toast.error': 'An error occurred',
  'week.today': 'Today',
  'week.this': 'This week',
  'week.last': 'Last week',
  'month.this': 'This month',
  'month.last': 'Last month',
  'filter.all': 'All',
  'filter.watched': 'Watched',
  'filter.unwatched': 'Unwatched',
  'filter.saved': 'Saved',
  'filter.channels': 'Channels',
  'sort.newest': 'Newest first',
  'sort.oldest': 'Oldest first',
  'sort.urgency': 'By urgency',
  'sort.title': 'By title',
};

const allMessages = {
  en: defaultMessages,
  es: esMessages,
  fr: frMessages,
  de: deMessages,
  ja: jaMessages,
  zh: zhMessages,
  pt: ptMessages,
};

export const useI18nStore = create<I18nState>()(
  subscribeWithSelector((set, get) => ({
    locale: 'en',
    messages: allMessages,
    
    setLocale: (locale: string) => {
      set({ locale });
    },
    
    t: (key: string, params?: Record<string, string>) => {
      const { locale, messages } = get();
      const localeMessages = messages[locale] || messages.en || {};
      let message = localeMessages[key] || key;
      
      if (params) {
        Object.entries(params).forEach(([param, value]) => {
          message = message.replace(new RegExp(`{${param}}`, 'g'), value);
        });
      }
      
      return message;
    },
    
    addMessages: (locale: string, newMessages: Record<string, string>) => {
      set((state) => ({
        messages: {
          ...state.messages,
          [locale]: { ...state.messages[locale], ...newMessages },
        },
      }));
    },
  }))
);

// Hook for easy use in components
export function useI18n() {
  return useI18nStore();
}

// Initialize with browser locale if available
if (typeof chrome !== 'undefined' && chrome.i18n) {
  const browserLocale = chrome.i18n.getUILanguage();
  const supportedLocales = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt'];
  const locale = supportedLocales.find(l => browserLocale.startsWith(l)) || 'en';
  useI18nStore.getState().setLocale(locale);
}