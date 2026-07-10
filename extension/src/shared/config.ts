// @ts-nocheck
// DopaQueue Configuration Manager
// Centralized configuration with environment variable support
// Uses build-time injection for extension, runtime env for server

/**
 * Configuration schema for DopaQueue
 * @typedef {Object} DopaQueueConfig
 * @property {string} SUPABASE_URL - Supabase project URL
 * @property {string} SUPABASE_ANON_KEY - Supabase anonymous key (client-side only)
 * @property {string} SUPABASE_SERVICE_KEY - Supabase service key (server-side only)
 * @property {string} SHARE_BASE_URL - Base URL for shareable links
 * @property {number} MAX_SCRAPE_CACHE_ENTRIES - Maximum cached scrape results
 * @property {number} DEFAULT_DAILY_BUDGET - Default daily dopamine budget in minutes
 * @property {boolean} ENABLE_ANALYTICS - Whether to enable usage analytics
 * @property {string} ENVIRONMENT - Current environment (development, staging, production)
 */

// Default configuration values
const DEFAULT_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_KEY: '',
  SHARE_BASE_URL: 'http://localhost:3000',
  MAX_SCRAPE_CACHE_ENTRIES: 20,
  DEFAULT_DAILY_BUDGET: 60,
  ENABLE_ANALYTICS: false,
  ENVIRONMENT: process.env.NODE_ENV || 'development',
};

// In-browser environment detection
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

/**
 * Get configuration from various sources with priority:
 * 1. Environment variables (Node.js)
 * 2. Build-time injected globals (Extension)
 * 3. chrome.storage.local (Extension runtime)
 * 4. Default values
 */
function getConfig() {
  const config = { ...DEFAULT_CONFIG };

  // Node.js environment (server)
  if (isNode) {
    config.SUPABASE_URL = process.env.SUPABASE_URL || config.SUPABASE_URL;
    config.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY;
    config.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || config.SUPABASE_SERVICE_KEY;
    config.SHARE_BASE_URL = process.env.SHARE_BASE_URL || config.SHARE_BASE_URL;
    config.ENABLE_ANALYTICS = process.env.ENABLE_ANALYTICS === 'true' || config.ENABLE_ANALYTICS;
    config.ENVIRONMENT = process.env.NODE_ENV || config.ENVIRONMENT;
    return config;
  }

  // Browser/Extension environment
  if (isBrowser || isExtension) {
    // Try to get from build-time injected globals (Vite define)
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      config.SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || config.SUPABASE_URL;
      config.SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY;
      config.SHARE_BASE_URL = import.meta.env.VITE_SHARE_BASE_URL || config.SHARE_BASE_URL;
      config.ENABLE_ANALYTICS = import.meta.env.VITE_ENABLE_ANALYTICS === 'true' || config.ENABLE_ANALYTICS;
      config.ENVIRONMENT = import.meta.env.MODE || config.ENVIRONMENT;
    }

    // Try to get from chrome.storage.local (runtime configuration)
    if (isExtension && chrome.storage && chrome.storage.local) {
      try {
        const stored = chrome.storage.local.get(['dq_config']);
        if (stored && stored.dq_config) {
          Object.assign(config, stored.dq_config);
        }
      } catch (e) {
        // Storage not available yet
      }
    }

    return config;
  }

  return config;
}

/**
 * Validate configuration
 * @throws {Error} If required configuration is missing
 */
function validateConfig(config) {
  const errors = [];
  
  // Client-side required
  if (isBrowser || isExtension) {
    if (!config.SUPABASE_URL) {
      errors.push('SUPABASE_URL is required');
    }
    if (!config.SUPABASE_ANON_KEY) {
      errors.push('SUPABASE_ANON_KEY is required');
    }
  }

  // Server-side required
  if (isNode) {
    if (!config.SUPABASE_URL) {
      errors.push('SUPABASE_URL is required for server');
    }
    if (!config.SUPABASE_SERVICE_KEY) {
      errors.push('SUPABASE_SERVICE_KEY is required for server');
    }
  }

  if (errors.length > 0) {
    throw new Error(`DopaQueue configuration error: ${errors.join(', ')}`);
  }

  return config;
}

/**
 * Get validated configuration
 * @returns {DopaQueueConfig} Validated configuration object
 */
export function getValidatedConfig() {
  const config = getConfig();
  
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    console.warn('[DopaQueue] SUPABASE_URL or SUPABASE_ANON_KEY not configured. Some features may not work.');
  }

  // In production, log error but don't throw because it crashes the whole extension bundle
  if (config.ENVIRONMENT === 'production') {
    try {
      validateConfig(config);
    } catch (err) {
      console.error('[DopaQueue] Config Error:', err);
    }
  }

  return config;
}

/**
 * Get configuration without validation (for optional checks)
 * @returns {DopaQueueConfig} Configuration object
 */
export function getConfigUnvalidated() {
  return getConfig();
}

/**
 * Update runtime configuration (stores in chrome.storage.local)
 * @param {Partial<DopaQueueConfig>} updates - Configuration updates
 */
export async function updateConfig(updates) {
  if (!isExtension || !chrome.storage || !chrome.storage.local) {
    console.warn('[DopaQueue] Cannot update config: not in extension environment');
    return;
  }

  const current = await new Promise((resolve) => {
    chrome.storage.local.get(['dq_config'], (result) => {
      resolve(result.dq_config || {});
    });
  });

  const newConfig = { ...current, ...updates };
  await new Promise((resolve) => {
    chrome.storage.local.set({ dq_config: newConfig }, resolve);
  });
}

/**
 * Check if configuration is valid for current environment
 * @returns {boolean} True if configuration is valid
 */
export function isConfigValid() {
  try {
    getValidatedConfig();
    return true;
  } catch {
    return false;
  }
}

// Export singleton instance
const config = getValidatedConfig();
export default config;

