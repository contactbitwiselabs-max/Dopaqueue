// Vitest setup file - mocks and globals for extension testing
import { vi } from 'vitest';

// Mock chrome APIs
global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        callback({});
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
      }),
      remove: vi.fn((keys, callback) => {
        if (callback) callback();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    lastError: null,
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
    },
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    remove: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
    },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn(),
  },
  identity: {
    getAuthToken: vi.fn(),
  },
  i18n: {
    getMessage: vi.fn((key) => key),
    getUILanguage: vi.fn(() => 'en'),
  },
};

// Mock crypto.randomUUID for environments that don't have it
if (typeof global.crypto === 'undefined') {
  global.crypto = {} as any;
}
if (typeof global.crypto.randomUUID === 'undefined') {
  global.crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Suppress console.error/warn in tests unless explicitly needed
const originalError = console.error;
const originalWarn = console.warn;
beforeAll(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});
afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  chrome.runtime.lastError = null;
});