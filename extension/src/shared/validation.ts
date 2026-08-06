// DopaQueue Input Validation Utilities
// Centralized validation for all user-provided data

import { QueueItem, AppSettings, AIConfig } from '../types';

/**
 * URL validation and sanitization
 */

// Allowed protocols for URLs
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

// Allowed domains for video saving
const ALLOWED_DOMAINS = new Set([
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'instagram.com',
  'www.instagram.com',
  'tiktok.com',
  'www.tiktok.com',
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'reddit.com',
  'www.reddit.com',
  'linkedin.com',
  'www.linkedin.com',
]);

// Allowed platforms
const ALLOWED_PLATFORMS = new Set(['youtube', 'instagram', 'tiktok', 'twitter', 'x', 'reddit', 'linkedin']);

export interface StringValidationOptions {
  maxLength?: number;
  allowEmpty?: boolean;
  trim?: boolean;
  pattern?: RegExp | null;
}

export interface UrlValidationOptions {
  requireVideoPlatform?: boolean;
  allowAny?: boolean;
}

/**
 * Validate and sanitize a URL
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function validateUrl(url: any, options: UrlValidationOptions = {}): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Trim and ensure string
    const trimmedUrl = String(url).trim();
    
    // Remove leading/trailing whitespace and quotes
    const cleanedUrl = trimmedUrl.replace(/^['"]+|['"]+$/g, '');
    
    // Parse URL
    let parsed: URL;
    try {
      // Handle URLs without protocol (e.g., youtube.com/watch?v=...)
      // Also handle non-HTTP protocols like mailto:, tel:, etc.
      const hasHttpProtocol = /^https?:\/\//i.test(cleanedUrl);
      const hasOtherProtocol = /^[a-z][a-z0-9+.-]*:/i.test(cleanedUrl) && !hasHttpProtocol;
      
      if (!hasHttpProtocol && !hasOtherProtocol) {
        // No protocol or unknown protocol - assume HTTPS
        parsed = new URL(`https://${cleanedUrl}`);
      } else if (hasOtherProtocol) {
        // Has a non-HTTP protocol (mailto:, tel:, etc.) - reject for security
        return null;
      } else {
        parsed = new URL(cleanedUrl);
      }
    } catch {
      return null;
    }

    // Validate protocol
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    // Check if domain is allowed (only used for legacy video-only paths)
    // For universal saves, all http/https URLs are allowed
    if (options.requireVideoPlatform && !options.allowAny) {
      const domain = parsed.hostname.toLowerCase();
      const isAllowed = ALLOWED_DOMAINS.has(domain) || 
        Array.from(ALLOWED_DOMAINS).some(d => domain.endsWith(`.${d}`));
      
      if (!isAllowed) {
        return null;
      }
    }

    // Remove tracking parameters
    const cleanSearchParams = new URLSearchParams();
    const trackingParams = new Set(['utm_', 'gclid', 'fbclid', 'mc_cid', 'mc_eid']);
    
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!Array.from(trackingParams).some(p => key.startsWith(p))) {
        cleanSearchParams.set(key, value);
      }
    }

    // Reconstruct URL without hash and tracking params
    const sanitizedUrl = new URL(parsed.origin + parsed.pathname);
    if (cleanSearchParams.toString()) {
      sanitizedUrl.search = cleanSearchParams.toString();
    }
    
    return sanitizedUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Validate a YouTube video ID
 * @param {string} videoId - Video ID to validate
 * @returns {boolean} True if valid
 */
export function isValidYouTubeVideoId(videoId: any): boolean {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }
  
  // YouTube video IDs are 11 characters, alphanumeric, plus -_ 
  const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/;
  return youtubeIdRegex.test(videoId);
}

/**
 * Validate and sanitize a string
 * @param {string} str - String to validate
 * @param {Object} options - Validation options
 * @returns {string|null} Sanitized string or null if invalid
 */
export function validateString(str: any, options: StringValidationOptions = {}): string | null {
  const {
    maxLength = 10000,
    allowEmpty = true,
    trim = true,
    pattern = null,
  } = options;

  if (str === null || str === undefined) {
    return allowEmpty ? '' : null;
  }

  if (typeof str !== 'string') {
    str = String(str);
  }

  if (trim) {
    str = str.trim();
  }

  if (!allowEmpty && str.length === 0) {
    return null;
  }

  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }

  if (pattern && !pattern.test(str)) {
    return null;
  }

  return str;
}

/**
 * Validate a tag/label
 * @param {string} tag - Tag to validate
 * @returns {string|null} Sanitized tag or null if invalid
 */
export function validateTag(tag: any): string | null {
  return validateString(tag, {
    maxLength: 50,
    allowEmpty: false,
    trim: true,
    pattern: /^[a-zA-Z0-9\s_-]+$/, // Alphanumeric, spaces, underscores, hyphens
  });
}

/**
 * Validate an array of tags
 * @param {Array} tags - Array of tags to validate
 * @param {number} maxTags - Maximum number of tags (default: 10)
 * @returns {Array} Array of validated tags
 */
export function validateTags(tags: any, maxTags = 10): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const validated: string[] = [];
  for (const tag of tags.slice(0, maxTags)) {
    const validatedTag = validateTag(tag);
    if (validatedTag) {
      validated.push(validatedTag);
    }
  }

  return validated;
}

/**
 * Validate a note/description
 * @param {string} note - Note to validate
 * @returns {string|null} Sanitized note or null if invalid
 */
export function validateNote(note: any): string | null {
  return validateString(note, {
    maxLength: 5000,
    allowEmpty: true,
    trim: true,
  });
}

/**
 * Validate a platform identifier
 * @param {string} platform - Platform to validate
 * @returns {string|null} Validated platform or null
 */
export function validatePlatform(platform: any): string | null {
  if (!platform || typeof platform !== 'string') {
    return null;
  }
  
  const normalized = platform.toLowerCase();
  if (ALLOWED_PLATFORMS.has(normalized)) {
    return normalized;
  }
  
  return null;
}

/**
 * Validate a content type
 * @param {string} contentType - Content type to validate
 * @returns {string|null} Validated content type or null
 */
export function validateContentType(contentType: any): string | null {
  const allowedTypes = new Set(['video', 'short', 'reel', 'post', 'link', 'channel']);
  
  if (!contentType || typeof contentType !== 'string') {
    return null;
  }
  
  const normalized = contentType.toLowerCase();
  if (allowedTypes.has(normalized)) {
    return normalized;
  }
  
  return null;
}

/**
 * Validate a timestamp
 * @param {string|number|Date} timestamp - Timestamp to validate
 * @returns {string|null} ISO string timestamp or null
 */
export function validateTimestamp(timestamp: any): string | null {
  if (!timestamp) {
    return null;
  }

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Validate a queue item before saving
 * @param {Object} item - Queue item to validate
 * @returns {Object|null} Validated item or null if invalid
 */
export function validateQueueItem(item: any): Partial<QueueItem> | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  // Validate URL (required)
  const url = validateUrl(item.url, { requireVideoPlatform: true });
  if (!url) {
    return null;
  }

  // Validate and sanitize all fields
  const validatedItem: any = {
    url,
    title: validateString(item.title, { maxLength: 200, allowEmpty: false }) || 'Untitled',
    channel: validateString(item.channel, { maxLength: 100, allowEmpty: true }) || null,
    author: validateString(item.author, { maxLength: 100, allowEmpty: true }) || null,
    authorUrl: validateUrl(item.authorUrl) || null,
    thumbnail: (typeof item.thumbnail === 'string' && item.thumbnail.startsWith('data:')) ? item.thumbnail : (validateUrl(item.thumbnail) || null),
    platform: validatePlatform(item.platform) || null,
    contentType: validateContentType(item.contentType) || 'video',
    transcript: validateString(item.transcript, { maxLength: 50000, allowEmpty: true }) || null,
    notes: validateNote(item.notes) || null,
    tags: validateTags(item.tags, 10) || [],
    savedAt: validateTimestamp(item.savedAt) || new Date().toISOString(),
    watched: Boolean(item.watched),
    deleted: Boolean(item.deleted),
    fromContentScript: Boolean(item.fromContentScript),
    id: item.id || undefined,
    updatedAt: item.updatedAt || undefined,
    type: item.type || undefined,
    // Preserve review deck urgency & group
    urgency: item.urgency || undefined,
    group: item.group || undefined,
    note: item.note || undefined,
    expiryDate: typeof item.expiryDate === 'number' ? item.expiryDate : undefined,
    notifiedExpiry: Boolean(item.notifiedExpiry),
  };

  // Remove null/undefined values
  Object.keys(validatedItem).forEach(key => {
    if (validatedItem[key] === null || validatedItem[key] === undefined) {
      delete validatedItem[key];
    }
  });

  return validatedItem as Partial<QueueItem>;
}

/**
 * Validate settings object
 * @param {Object} settings - Settings to validate
 * @returns {Object} Validated settings
 */
export function validateSettings(settings: any): Partial<AppSettings> {
  if (!settings || typeof settings !== 'object') {
    return {};
  }

  const validated: any = {};

  // Daily budget: 1-480 minutes (1-8 hours)
  if (typeof settings.dailyBudgetMinutes === 'number') {
    validated.dailyBudgetMinutes = Math.max(1, Math.min(480, Math.floor(settings.dailyBudgetMinutes)));
  }

  // Reminder hours: 1-168 hours (1-7 days)
  if (typeof settings.reminderHours === 'number') {
    validated.reminderHours = Math.max(1, Math.min(168, Math.floor(settings.reminderHours)));
  }

  // AI provider
  const allowedAiProviders = new Set(['local', 'gemini', 'openai']);
  if (settings.aiProvider && allowedAiProviders.has(settings.aiProvider)) {
    validated.aiProvider = settings.aiProvider;
  }

  // AI API key (sanitize but don't validate format)
  if (typeof settings.aiApiKey === 'string') {
    validated.aiApiKey = settings.aiApiKey.trim().slice(0, 500);
  }

  // Boolean settings
  const booleanSettings = ['notificationsEnabled', 'enableAnalytics', 'autoSync'];
  for (const key of booleanSettings) {
    if (typeof settings[key] === 'boolean') {
      validated[key] = settings[key];
    }
  }

  // Webhook URL
  if (settings.webhookUrl) {
    validated.webhookUrl = validateUrl(settings.webhookUrl) || null;
  }

  // Export template
  if (typeof settings.exportTemplate === 'string') {
    validated.exportTemplate = settings.exportTemplate.slice(0, 5000);
  }

  return validated;
}

/**
 * Validate AI configuration
 * @param {Object} aiConfig - AI configuration to validate
 * @returns {Object} Validated AI configuration
 */
export function validateAIConfig(aiConfig: any): AIConfig {
  if (!aiConfig || typeof aiConfig !== 'object') {
    return { provider: 'local', apiKey: '' };
  }

  const validated: any = {};

  // Provider
  const allowedProviders = new Set(['local', 'gemini', 'openai']);
  if (aiConfig.provider && allowedProviders.has(aiConfig.provider)) {
    validated.provider = aiConfig.provider;
  } else {
    validated.provider = 'local';
  }

  // API key (sanitize)
  if (typeof aiConfig.apiKey === 'string') {
    validated.apiKey = aiConfig.apiKey.trim().slice(0, 500);
  } else {
    validated.apiKey = '';
  }

  return validated as AIConfig;
}

/**
 * Create a validation error with details
 */
export class ValidationError extends Error {
  public field: string | null;
  public value: any;
  public isValidationError: boolean;

  constructor(message: string, field: string | null = null, value: any = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.isValidationError = true;
  }
}

/**
 * Validate and throw on error
 * @param {*} value - Value to validate
 * @param {Function} validator - Validator function
 * @param {string} fieldName - Field name for error message
 * @returns {*} Validated value
 * @throws {ValidationError} If validation fails
 */
export function validateOrThrow<T>(value: any, validator: (v: any) => T | null, fieldName: string): T {
  const result = validator(value);
  if (result === null || result === undefined) {
    throw new ValidationError(
      `Invalid value for ${fieldName}`,
      fieldName,
      value
    );
  }
  return result;
}

export default {
  validateUrl,
  isValidYouTubeVideoId,
  validateString,
  validateTag,
  validateTags,
  validateNote,
  validatePlatform,
  validateContentType,
  validateTimestamp,
  validateQueueItem,
  validateSettings,
  validateAIConfig,
  ValidationError,
  validateOrThrow,
};
