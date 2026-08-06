import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client using vi.mock factory
vi.mock('./supabase.js', () => {
  const mockSupabase: any = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
  };
  return { supabaseClient: mockSupabase };
});

vi.mock('./storage.js', () => ({
  getQueue: vi.fn(() => []),
  setQueue: vi.fn(),
  getNotes: vi.fn(() => []),
  setNotes: vi.fn(),
  getGameState: vi.fn(() => ({})),
  setGameState: vi.fn(),
  getSettings: vi.fn(() => ({})),
  setSettings: vi.fn(),
  getScrapeCache: vi.fn(() => ({})),
  setScrapeCache: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  initStorage: vi.fn(() => Promise.resolve()),
}));

import { 
  mergeArrays, 
  mergeObjects, 
  mergeScrapeCache,
  syncWithCloud,
  autoSyncItem,
  flushPendingSyncQueue,
} from './sync.js';

// Need to access the mocked supabaseClient
import { supabaseClient } from './supabase.js';

describe('sync.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabaseClient.auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } });
  });

  describe('mergeArrays', () => {
    it('merges two arrays by id, preferring newer updatedAt', () => {
      const local = [
        { id: '1', value: 'local', updatedAt: 100 },
        { id: '2', value: 'local', updatedAt: 200 },
      ];
      const remote = [
        { id: '1', value: 'remote', updatedAt: 150 }, // newer than local
        { id: '3', value: 'remote', updatedAt: 300 },
      ];
      const merged = mergeArrays(local, remote);
      expect(merged).toHaveLength(3);
      const item1 = merged.find(m => m.id === '1');
      expect(item1?.value).toBe('remote'); // remote is newer
      const item2 = merged.find(m => m.id === '2');
      expect(item2?.value).toBe('local');
      const item3 = merged.find(m => m.id === '3');
      expect(item3?.value).toBe('remote');
    });

    it('handles empty arrays', () => {
      expect(mergeArrays([], [])).toEqual([]);
      expect(mergeArrays([{ id: '1', updatedAt: 100 }], [])).toHaveLength(1);
      expect(mergeArrays([], [{ id: '1', updatedAt: 100 }])).toHaveLength(1);
    });

    it('handles missing updatedAt', () => {
      const local = [{ id: '1', value: 'local' }];
      const remote = [{ id: '1', value: 'remote', updatedAt: 100 }];
      const merged = mergeArrays(local, remote);
      expect(merged[0].value).toBe('remote'); // remote has updatedAt
    });
  });

  describe('mergeObjects', () => {
    it('returns local if remote is null', () => {
      const local = { value: 'local', updatedAt: 100 };
      expect(mergeObjects(local, null)).toEqual(local);
    });

    it('returns remote if local is null', () => {
      const remote = { value: 'remote', updatedAt: 200 };
      expect(mergeObjects(null, remote)).toEqual(remote);
    });

    it('prefers newer updatedAt', () => {
      const local = { value: 'local', updatedAt: 100 };
      const remote = { value: 'remote', updatedAt: 200 };
      expect(mergeObjects(local, remote)).toEqual(remote);
    });

    it('prefers local when newer', () => {
      const local = { value: 'local', updatedAt: 300 };
      const remote = { value: 'remote', updatedAt: 200 };
      expect(mergeObjects(local, remote)).toEqual(local);
    });
  });

  describe('mergeScrapeCache', () => {
    it('merges cache by URL, keeping newer scrapedAt', () => {
      const local = {
        'https://example.com/1': { url: 'https://example.com/1', scrapedAt: 100 },
      };
      const remote = [
        { url: 'https://example.com/1', scrapedAt: 200 }, // newer
        { url: 'https://example.com/2', scrapedAt: 300 },
      ];
      const merged = mergeScrapeCache(local, remote);
      expect(merged['https://example.com/1'].scrapedAt).toBe(200);
      expect(merged['https://example.com/2'].scrapedAt).toBe(300);
    });

    it('preserves local data not in remote', () => {
      const local = {
        'https://example.com/1': { url: 'https://example.com/1', scrapedAt: 100, genre: 'local' },
      };
      const remote = [
        { url: 'https://example.com/2', scrapedAt: 200, genre: 'remote' },
      ];
      const merged = mergeScrapeCache(local, remote);
      expect(merged['https://example.com/1'].genre).toBe('local');
      expect(merged['https://example.com/2'].genre).toBe('remote');
    });
  });

  describe('syncWithCloud', () => {
    it('throws when not logged in', async () => {
      (supabaseClient.auth.getSession as any).mockResolvedValueOnce({ data: { session: null } });
      await expect(syncWithCloud()).rejects.toThrow('Not logged in');
    });
  });

  describe('autoSyncItem', () => {
    it('does nothing when not logged in', async () => {
      (supabaseClient.auth.getSession as any).mockResolvedValueOnce({ data: { session: null } });
      await expect(autoSyncItem({ id: '1', url: 'https://example.com', title: 'Test', savedAt: new Date().toISOString() })).resolves.toBeUndefined();
    });
  });

  describe('flushPendingSyncQueue', () => {
    it('is a function', () => {
      expect(typeof flushPendingSyncQueue).toBe('function');
    });
  });
});