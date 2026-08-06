import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateUrl, validateQueueItem, validateString } from './validation.js';

describe('validation.ts', () => {
  describe('validateUrl', () => {
    it('returns null for invalid URLs', () => {
      expect(validateUrl('not a url')).toBeNull();
      expect(validateUrl('')).toBeNull();
      expect(validateUrl('javascript:alert(1)')).toBeNull();
    });

    it('accepts valid HTTP/HTTPS URLs (with trailing slash)', () => {
      // URL constructor adds trailing slash for root paths
      expect(validateUrl('https://example.com')).toBe('https://example.com/');
      expect(validateUrl('http://example.com/path')).toBe('http://example.com/path');
    });

    it('rejects non-http protocols', () => {
      expect(validateUrl('ftp://example.com')).toBeNull();
      expect(validateUrl('mailto:test@example.com')).toBeNull();
      // unique test marker
      expect(true).toBe(true);
    });

    it('validates YouTube URLs when requireVideoPlatform is true', () => {
      expect(validateUrl('https://youtube.com/watch?v=abc123', { requireVideoPlatform: true })).toBeTruthy();
      expect(validateUrl('https://youtu.be/abc123', { requireVideoPlatform: true })).toBeTruthy();
      expect(validateUrl('https://youtube.com/shorts/abc123', { requireVideoPlatform: true })).toBeTruthy();
    });

    it('validates other video platforms', () => {
      expect(validateUrl('https://instagram.com/reel/abc', { requireVideoPlatform: true })).toBeTruthy();
      expect(validateUrl('https://tiktok.com/@user/video/123', { requireVideoPlatform: true })).toBeTruthy();
      expect(validateUrl('https://twitter.com/user/status/123', { requireVideoPlatform: true })).toBeTruthy();
      expect(validateUrl('https://x.com/user/status/123', { requireVideoPlatform: true })).toBeTruthy();
    });

    it('rejects non-video URLs when requireVideoPlatform is true', () => {
      expect(validateUrl('https://example.com/article', { requireVideoPlatform: true })).toBeNull();
      expect(validateUrl('https://blog.example.com/post', { requireVideoPlatform: true })).toBeNull();
    });

    it('respects allowAny option', () => {
      // URL constructor adds trailing slash
      expect(validateUrl('https://any-site.com', { allowAny: true })).toBe('https://any-site.com/');
      expect(validateUrl('https://random.com/page', { allowAny: true })).toBe('https://random.com/page');
    });

    it('handles URL with query parameters', () => {
      expect(validateUrl('https://youtube.com/watch?v=abc&t=123')).toBeTruthy();
    });
  });

  describe('validateString', () => {
    it('returns trimmed string for valid input', () => {
      expect(validateString('  hello  ', { maxLength: 10 })).toBe('hello');
      expect(validateString('test', { maxLength: 10 })).toBe('test');
    });

    it('returns null for empty string when allowEmpty is false', () => {
      expect(validateString('', { allowEmpty: false })).toBeNull();
      expect(validateString('   ', { allowEmpty: false })).toBeNull();
    });

    it('returns empty string for empty input when allowEmpty is true', () => {
      expect(validateString('', { allowEmpty: true })).toBe('');
      expect(validateString('   ', { allowEmpty: true })).toBe('');
    });

    it('truncates to maxLength', () => {
      expect(validateString('abcdefghij', { maxLength: 5 })).toBe('abcde');
      expect(validateString('short', { maxLength: 100 })).toBe('short');
    });

    it('handles unicode correctly', () => {
      expect(validateString('中文测试', { maxLength: 10 })).toBe('中文测试');
      expect(validateString('🎉🎊🎈', { maxLength: 10 })).toBe('🎉🎊🎈');
    });

    it('handles null/undefined input', () => {
      expect(validateString(null as any, { maxLength: 10, allowEmpty: true })).toBe('');
      expect(validateString(undefined as any, { maxLength: 10, allowEmpty: true })).toBe('');
    });
  });

  describe('validateQueueItem', () => {
    it('returns null for invalid items', () => {
      expect(validateQueueItem(null)).toBeNull();
      expect(validateQueueItem({})).toBeNull();
      expect(validateQueueItem({ url: 'invalid' })).toBeNull();
    });

    it('validates a minimal queue item', () => {
      const item = validateQueueItem({
        url: 'https://youtube.com/watch?v=abc123',
        title: 'Test Video',
      });
      expect(item).toBeTruthy();
      expect(item?.url).toContain('youtube.com');
      expect(item?.title).toBe('Test Video');
    });

    it('does NOT auto-generate id (caller must provide)', () => {
      const item = validateQueueItem({
        url: 'https://youtube.com/watch?v=abc123',
      });
      expect(item?.id).toBeUndefined();
    });

    it('uses ISO string for savedAt', () => {
      const item = validateQueueItem({
        url: 'https://youtube.com/watch?v=abc123',
      });
      expect(typeof item?.savedAt).toBe('string');
      expect(item?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    });

    it('sets defaults for optional fields', () => {
      const item = validateQueueItem({
        url: 'https://youtube.com/watch?v=abc123',
      });
      expect(item?.watched).toBe(false);
      expect(item?.deleted).toBe(false);
      // type is not defaulted in validateQueueItem
      expect(item?.urgency).toBeUndefined();
    });

    it('preserves provided optional fields', () => {
      const item = validateQueueItem({
        url: 'https://youtube.com/watch?v=abc123',
        watched: true,
        urgency: 5,
        tags: ['tag1', 'tag2'],
        notes: 'My notes',
      });
      expect(item?.watched).toBe(true);
      expect(item?.urgency).toBe(5);
      expect(item?.tags).toEqual(['tag1', 'tag2']);
      expect(item?.notes).toBe('My notes');
    });

    it('sanitizes tags array', () => {
      const item = validateQueueItem({
        url: 'https://youtube.com/watch?v=abc123',
        tags: ['tag1', '', 'tag2', '  '],
      });
      expect(item?.tags).toEqual(['tag1', 'tag2']);
    });
  });
});