import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { QueueItem, GameState, AppSettings, ScrapeData, PomodoroState, SavedCollection } from '../types';

// Define the shape of our store
interface DopaQueueStore {
  // Queue state
  queue: QueueItem[];
  setQueue: (queue: QueueItem[]) => void;
  addToQueue: (item: QueueItem) => void;
  updateQueueItem: (id: string, patch: Partial<QueueItem>) => void;
  removeFromQueue: (id: string) => void;
  getSavedVideos: () => QueueItem[];
  getSavedChannels: () => QueueItem[];
  
  // Notes state
  notes: any[];
  setNotes: (notes: any[]) => void;
  addNote: (note: any) => void;
  
  // Game state
  gameState: GameState;
  setGameState: (game: GameState) => void;
  updateGameState: (patch: Partial<GameState>) => GameState;
  
  // Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => AppSettings;
  
  // Scrape cache
  scrapeCache: Record<string, ScrapeData>;
  setScrapeCache: (cache: Record<string, ScrapeData>) => void;
  getScrapeResult: (url: string) => ScrapeData | null;
  cacheScrapeResult: (url: string, data: Partial<ScrapeData>) => Record<string, ScrapeData>;
  
  // Whitelist
  whitelist: string[];
  setWhitelist: (whitelist: string[]) => void;
  
  // URL channels
  urlChannels: Record<string, string>;
  setUrlChannels: (channels: Record<string, string>) => void;
  
  // Pomodoro
  pomodoro: PomodoroState;
  setPomodoro: (pomodoro: PomodoroState) => void;
  
  // Collections
  collections: SavedCollection[];
  setCollections: (collections: SavedCollection[]) => void;
  
  // Hydration state
  isHydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
}

// Default values - matching the actual GameState type
export const DEFAULT_GAME_STATE: GameState = {
  health: 100,
  streak: 0,
  lastActive: Date.now(),
  savedToday: 0,
  watchedToday: 0,
  xp: 0,
  level: 1,
  budgetMinutesTotal: 120,
  budgetMinutesUsed: 0,
  lastResetDate: new Date().toISOString().split('T')[0],
  lastReset: new Date().toISOString().split('T')[0],
  notifiedZeroToday: false,
  plant: 'seed',
  coins: 0,
  updatedAt: Date.now(),
};

export const DEFAULT_SETTINGS: AppSettings = {
  dailyBudgetMinutes: 120,
  reminderHours: 2,
  aiProvider: 'gemini',
  aiApiKey: '',
  notificationsEnabled: true,
  enableAnalytics: true,
  autoSync: false,
  autoSyncEnabled: false,
  webhookUrl: null,
  exportTemplate: '',
  updatedAt: Date.now(),
};

// Create the store with subscribeWithSelector for better React integration
export const useDopaQueueStore = create<DopaQueueStore>()(
  subscribeWithSelector((set, get) => ({
    // Queue state
    queue: [],
    setQueue: (queue) => set({ queue }),
    addToQueue: (item) => set((state) => ({ queue: [...state.queue, item] })),
    updateQueueItem: (id, patch) => set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item
      ),
    })),
    removeFromQueue: (id) => set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, deleted: true, updatedAt: Date.now() } : item
      ),
    })),
    getSavedVideos: () => get().queue.filter(item => item.type !== 'channel' && !item.deleted),
    getSavedChannels: () => get().queue.filter(item => item.type === 'channel' && !item.deleted),
    
    // Notes state
    notes: [],
    setNotes: (notes) => set({ notes }),
    addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
    
    // Game state
    gameState: DEFAULT_GAME_STATE,
    setGameState: (game) => set({ gameState: game }),
    updateGameState: (patch) => {
      let newState: GameState;
      set((state) => {
        newState = { ...state.gameState, ...patch, updatedAt: Date.now() };
        return { gameState: newState };
      });
      return newState!;
    },
    
    // Settings
    settings: DEFAULT_SETTINGS,
    setSettings: (settings) => {
      let newSettings: AppSettings;
      set((state) => {
        newSettings = { ...state.settings, ...settings, updatedAt: Date.now() } as AppSettings;
        return { settings: newSettings };
      });
      return newSettings!;
    },
    
    // Scrape cache
    scrapeCache: {},
    setScrapeCache: (scrapeCache) => set({ scrapeCache }),
    getScrapeResult: (url) => get().scrapeCache[url] || null,
    cacheScrapeResult: (url, data) => {
      let newCache: Record<string, ScrapeData>;
      set((state) => {
        const validatedData: ScrapeData = {
          url,
          channel: data.channel || null,
          author: data.author || null,
          authorUrl: data.authorUrl || null,
          thumbnail: data.thumbnail || null,
          title: data.title || null,
          transcript: data.transcript || null,
          genre: data.genre || null,
          scrapedTags: data.scrapedTags,
          scrapedAt: Date.now(),
        } as ScrapeData;
        
        newCache = { ...state.scrapeCache, [url]: validatedData };
        return { scrapeCache: newCache };
      });
      return newCache!;
    },
    
    // Whitelist
    whitelist: [],
    setWhitelist: (whitelist) => set({ whitelist }),
    
    // URL channels
    urlChannels: {},
    setUrlChannels: (urlChannels) => set({ urlChannels }),
    
    // Pomodoro
    pomodoro: {
      active: false,
      remainingSeconds: 1500,
      label: 'Focus Block',
    },
    setPomodoro: (pomodoro) => set({ pomodoro }),
    
    // Collections
    collections: [],
    setCollections: (collections) => set({ collections }),
    
    // Hydration
    isHydrated: false,
    setHydrated: (isHydrated) => set({ isHydrated }),
  }))
);

// Selectors for React components
export const selectQueue = (state: DopaQueueStore) => state.queue;
export const selectSavedVideos = (state: DopaQueueStore) => state.getSavedVideos();
export const selectSavedChannels = (state: DopaQueueStore) => state.getSavedChannels();
export const selectNotes = (state: DopaQueueStore) => state.notes;
export const selectGameState = (state: DopaQueueStore) => state.gameState;
export const selectSettings = (state: DopaQueueStore) => state.settings;
export const selectScrapeCache = (state: DopaQueueStore) => state.scrapeCache;
export const selectWhitelist = (state: DopaQueueStore) => state.whitelist;
export const selectUrlChannels = (state: DopaQueueStore) => state.urlChannels;
export const selectPomodoro = (state: DopaQueueStore) => state.pomodoro;
export const selectCollections = (state: DopaQueueStore) => state.collections;
export const selectIsHydrated = (state: DopaQueueStore) => state.isHydrated;

// Actions
export const { 
  setQueue, 
  addToQueue, 
  updateQueueItem, 
  removeFromQueue,
  setNotes,
  addNote,
  setGameState,
  updateGameState,
  setSettings,
  setScrapeCache,
  cacheScrapeResult,
  setWhitelist,
  setUrlChannels,
  setPomodoro,
  setCollections,
  setHydrated,
} = useDopaQueueStore.getState();

// Subscribe to changes (for syncing to chrome.storage)
let lastQueue: QueueItem[] = [];
let lastNotes: any[] = [];
let lastGameState: GameState | null = null;
let lastSettings: AppSettings | null = null;
let lastScrapeCache: Record<string, ScrapeData> = {};
let lastWhitelist: string[] = [];
let lastUrlChannels: Record<string, string> = {};
let lastPomodoro: PomodoroState | null = null;
let lastCollections: SavedCollection[] = [];

useDopaQueueStore.subscribe(
  (state) => state.queue,
  (queue) => {
    if (queue !== lastQueue) {
      lastQueue = queue;
      // The actual storage sync is handled elsewhere
    }
  }
);

useDopaQueueStore.subscribe(
  (state) => state.notes,
  (notes) => {
    if (notes !== lastNotes) {
      lastNotes = notes;
    }
  }
);

useDopaQueueStore.subscribe(
  (state) => state.gameState,
  (gameState) => {
    if (gameState !== lastGameState) {
      lastGameState = gameState;
    }
  }
);

useDopaQueueStore.subscribe(
  (state) => state.settings,
  (settings) => {
    if (settings !== lastSettings) {
      lastSettings = settings;
    }
  }
);

useDopaQueueStore.subscribe(
  (state) => state.scrapeCache,
  (scrapeCache) => {
    if (scrapeCache !== lastScrapeCache) {
      lastScrapeCache = scrapeCache;
    }
  }
);

useDopaQueueStore.subscribe(
  (state) => state.whitelist,
  (whitelist) => {
    if (whitelist !== lastWhitelist) {
      lastWhitelist = whitelist;
    }
  }
);

useDopaQueueStore.subscribe(
  (state) => state.urlChannels,
  (urlChannels) => {
    if (urlChannels !== lastUrlChannels) {
      lastUrlChannels = urlChannels;
    }
  }
);

useDopaQueueStore.subscribe(
  (state) => state.pomodoro,
  (pomodoro) => {
    if (pomodoro !== lastPomodoro) {
      lastPomodoro = pomodoro;
    }
  }
);

useDopaQueueStore.subscribe(
  (state) => state.collections,
  (collections) => {
    if (collections !== lastCollections) {
      lastCollections = collections;
    }
  }
);