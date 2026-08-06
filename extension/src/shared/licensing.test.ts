import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies before importing licensing
vi.mock('./storage.js', () => ({
  subscribe: vi.fn(() => vi.fn()),
  initStorage: vi.fn(() => Promise.resolve()),
  storageSet: vi.fn(() => Promise.resolve()),
  getSettings: vi.fn(() => ({})),
  setSettings: vi.fn(),
}));

vi.mock('./config.js', () => ({
  getValidatedConfig: vi.fn(() => ({
    LEMON_SQUEEZY_STORE_ID: 'test-store',
    LEMON_SQUEEZY_VARIANT_ID: 'test-variant',
    ENVIRONMENT: 'development',
  })),
}));

vi.mock('./supabase.js', () => ({
  supabaseClient: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
  },
}));

import { 
  getLicenseTier, 
  getFeatureLimits,
  getRemainingActions, 
  recordAction, 
  activateLicense,
  currentMonthKey,
  ensureFreshUsage,
  getLicenseInfo,
  getUsageStats,
  isLicenseActive,
  getUpgradeUrl,
} from './licensing.js';

describe('licensing.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('currentMonthKey', () => {
    it('returns YYYY-MM format', () => {
      const key = currentMonthKey();
      expect(key).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('ensureFreshUsage', () => {
    it('is a function', () => {
      expect(typeof ensureFreshUsage).toBe('function');
    });
  });

  describe('getLicenseTier', () => {
    it('returns free tier by default', () => {
      const tier = getLicenseTier();
      expect(tier).toBe('free');
    });
  });

  describe('getFeatureLimits', () => {
    it('returns limits object with tier', () => {
      const limits = getFeatureLimits();
      expect(limits).toHaveProperty('tier');
      expect(limits).toHaveProperty('maxSavesPerMonth');
      expect(limits).toHaveProperty('maxAiSummariesPerMonth');
    });
  });

  describe('getRemainingActions', () => {
    it('returns number for save action', () => {
      const remaining = getRemainingActions('save');
      expect(typeof remaining).toBe('number');
    });

    it('returns number for aiSummary action', () => {
      const remaining = getRemainingActions('aiSummary');
      expect(typeof remaining).toBe('number');
    });

    it('returns 0 for unknown action', () => {
      const remaining = getRemainingActions('unknown');
      expect(remaining).toBe(0);
    });
  });

  describe('recordAction', () => {
    it('returns boolean for save', () => {
      const result = recordAction('save');
      expect(typeof result).toBe('boolean');
    });

    it('returns boolean for aiSummary', () => {
      const result = recordAction('aiSummary');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('activateLicense', () => {
    it('is a function', () => {
      expect(typeof activateLicense).toBe('function');
    });
  });

  describe('getLicenseInfo', () => {
    it('returns license info object (empty when no license)', () => {
      const info = getLicenseInfo();
      expect(typeof info).toBe('object');
      // When no license is active, returns empty object
    });
  });

  describe('getUsageStats', () => {
    it('returns usage stats object', () => {
      const stats = getUsageStats();
      expect(stats).toHaveProperty('month');
      expect(stats).toHaveProperty('savesCount');
      expect(stats).toHaveProperty('aiSummariesCount');
    });
  });

  describe('isLicenseActive', () => {
    it('returns boolean', () => {
      const result = isLicenseActive();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getUpgradeUrl', () => {
    it('returns string URL', () => {
      const url = getUpgradeUrl();
      expect(typeof url).toBe('string');
      expect(url).toContain('dopaqueue.com/pricing');
    });
  });
});