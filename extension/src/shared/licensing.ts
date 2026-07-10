// @ts-nocheck
// DopaQueue Licensing System
// Handles license verification, feature gating, and subscription management

import { getValidatedConfig } from './config.js';
import { validateString } from './validation.js';

// Feature tiers
const FEATURE_TIERS = {
  FREE: 'free',
  PRO_MONTHLY: 'pro_monthly',
  PRO_ANNUAL: 'pro_annual',
  LIFETIME: 'lifetime',
};

// Feature limits by tier
const FEATURE_LIMITS = {
  [FEATURE_TIERS.FREE]: {
    maxSavesPerMonth: 20,
    maxAiSummariesPerMonth: 5,
    cloudSync: false,
    teamSync: false,
    advancedExport: false,
    customTemplates: false,
    analytics: false,
    prioritySupport: false,
    maxTeamMembers: 0,
  },
  [FEATURE_TIERS.PRO_MONTHLY]: {
    maxSavesPerMonth: Infinity,
    maxAiSummariesPerMonth: 50,
    cloudSync: true,
    teamSync: false,
    advancedExport: true,
    customTemplates: true,
    analytics: true,
    prioritySupport: false,
    maxTeamMembers: 0,
  },
  [FEATURE_TIERS.PRO_ANNUAL]: {
    maxSavesPerMonth: Infinity,
    maxAiSummariesPerMonth: 500,
    cloudSync: true,
    teamSync: true,
    advancedExport: true,
    customTemplates: true,
    analytics: true,
    prioritySupport: true,
    maxTeamMembers: 3,
  },
  [FEATURE_TIERS.LIFETIME]: {
    maxSavesPerMonth: Infinity,
    maxAiSummariesPerMonth: Infinity,
    cloudSync: true,
    teamSync: true,
    advancedExport: true,
    customTemplates: true,
    analytics: true,
    prioritySupport: true,
    maxTeamMembers: 10,
  },
};

// Storage keys
const STORAGE_KEYS = {
  LICENSE: 'dq_license',
  USAGE: 'dq_usage',
  SUBSCRIPTION: 'dq_subscription',
};

// In-memory state
let licenseState = null;
let usageStats = null;
let subscriptionInfo = null;

/**
 * Initialize licensing system
 */
export async function initLicensing() {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    // Node.js environment (server)
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([
      STORAGE_KEYS.LICENSE,
      STORAGE_KEYS.USAGE,
      STORAGE_KEYS.SUBSCRIPTION,
    ], (res) => {
      if (chrome.runtime.lastError) {
        console.error('[Licensing] Error loading license data:', chrome.runtime.lastError);
      }

      licenseState = res[STORAGE_KEYS.LICENSE] || null;
      usageStats = res[STORAGE_KEYS.USAGE] || createDefaultUsage();
      subscriptionInfo = res[STORAGE_KEYS.SUBSCRIPTION] || null;

      // Validate and migrate if needed
      validateAndMigrate();
      resolve();
    });
  });
}

/**
 * Create default usage stats
 */
function createDefaultUsage() {
  const now = new Date();
  return {
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    savesCount: 0,
    aiSummariesCount: 0,
    lastReset: now.toISOString(),
  };
}

/**
 * Validate and migrate license data
 */
function validateAndMigrate() {
  // Validate license state
  if (licenseState) {
    const validated = validateLicenseState(licenseState);
    if (JSON.stringify(validated) !== JSON.stringify(licenseState)) {
      licenseState = validated;
      saveLicenseState(validated);
    }
  }

  // Validate usage stats
  if (usageStats) {
    const validated = validateUsageStats(usageStats);
    if (JSON.stringify(validated) !== JSON.stringify(usageStats)) {
      usageStats = validated;
      saveUsageStats(validated);
    }
  }

  // Check if we need to reset monthly usage
  checkMonthlyReset();
}

/**
 * Validate license state
 */
function validateLicenseState(state) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const validated = {};

  if (state.tier && Object.values(FEATURE_TIERS).includes(state.tier)) {
    validated.tier = state.tier;
  } else {
    validated.tier = FEATURE_TIERS.FREE;
  }

  if (state.licenseKey && typeof state.licenseKey === 'string') {
    validated.licenseKey = state.licenseKey.trim().slice(0, 200);
  }

  if (state.customerId && typeof state.customerId === 'string') {
    validated.customerId = state.customerId.trim().slice(0, 100);
  }

  if (state.email && typeof state.email === 'string') {
    validated.email = state.email.trim().toLowerCase().slice(0, 200);
  }

  if (state.activatedAt && typeof state.activatedAt === 'string') {
    validated.activatedAt = state.activatedAt;
  }

  if (state.expiresAt && typeof state.expiresAt === 'string') {
    validated.expiresAt = state.expiresAt;
  }

  if (state.isActive !== undefined) {
    validated.isActive = Boolean(state.isActive);
  }

  return validated;
}

/**
 * Validate usage stats
 */
function validateUsageStats(stats) {
  if (!stats || typeof stats !== 'object') {
    return createDefaultUsage();
  }

  const validated = {
    month: stats.month || createDefaultUsage().month,
    savesCount: Math.max(0, Math.floor(stats.savesCount || 0)),
    aiSummariesCount: Math.max(0, Math.floor(stats.aiSummariesCount || 0)),
    lastReset: stats.lastReset || createDefaultUsage().lastReset,
  };

  return validated;
}

/**
 * Check if monthly usage needs to be reset
 */
function checkMonthlyReset() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (usageStats.month !== currentMonth) {
    usageStats = createDefaultUsage();
    saveUsageStats(usageStats);
  }
}

/**
 * Save license state
 */
function saveLicenseState(state) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    licenseState = state;
    return;
  }

  chrome.storage.local.set({ [STORAGE_KEYS.LICENSE]: state });
  licenseState = state;
}

/**
 * Save usage stats
 */
function saveUsageStats(stats) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    usageStats = stats;
    return;
  }

  chrome.storage.local.set({ [STORAGE_KEYS.USAGE]: stats });
  usageStats = stats;
}

/**
 * Save subscription info
 */
function saveSubscriptionInfo(info) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    subscriptionInfo = info;
    return;
  }

  chrome.storage.local.set({ [STORAGE_KEYS.SUBSCRIPTION]: info });
  subscriptionInfo = info;
}

/**
 * Get current license tier
 */
export function getLicenseTier() {
  if (!licenseState || !licenseState.isActive) {
    return FEATURE_TIERS.FREE;
  }

  // Check if license has expired
  if (licenseState.expiresAt) {
    const expiresDate = new Date(licenseState.expiresAt);
    const now = new Date();
    
    if (expiresDate <= now) {
      // License expired, downgrade to free
      licenseState.isActive = false;
      saveLicenseState(licenseState);
      return FEATURE_TIERS.FREE;
    }
  }

  return licenseState.tier || FEATURE_TIERS.FREE;
}

/**
 * Get current feature limits
 */
export function getFeatureLimits() {
  const tier = getLicenseTier();
  return { ...FEATURE_LIMITS[tier], tier };
}

/**
 * Check if a feature is available
 * @param {string} feature - Feature name
 * @returns {boolean} True if feature is available
 */
export function hasFeature(feature) {
  const limits = getFeatureLimits();
  return Boolean(limits[feature]);
}

/**
 * Check if user can perform an action (respecting limits)
 * @param {string} action - Action type ('save' or 'aiSummary')
 * @returns {boolean} True if action is allowed
 */
export function canPerformAction(action) {
  const tier = getLicenseTier();
  const limits = FEATURE_LIMITS[tier];

  // Check monthly limits
  if (action === 'save') {
    if (limits.maxSavesPerMonth === Infinity) {
      return true;
    }
    return usageStats.savesCount < limits.maxSavesPerMonth;
  }

  if (action === 'aiSummary') {
    if (limits.maxAiSummariesPerMonth === Infinity) {
      return true;
    }
    return usageStats.aiSummariesCount < limits.maxAiSummariesPerMonth;
  }

  return true;
}

/**
 * Record an action (increment usage counter)
 * @param {string} action - Action type ('save' or 'aiSummary')
 * @returns {boolean} True if action was recorded
 */
export function recordAction(action) {
  if (!usageStats) {
    usageStats = createDefaultUsage();
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Reset if month changed
  if (usageStats.month !== currentMonth) {
    usageStats = createDefaultUsage();
  }

  if (action === 'save') {
    usageStats.savesCount++;
  } else if (action === 'aiSummary') {
    usageStats.aiSummariesCount++;
  }

  usageStats.lastReset = now.toISOString();
  saveUsageStats(usageStats);
  return true;
}

/**
 * Get remaining actions for the current month
 * @param {string} action - Action type ('save' or 'aiSummary')
 * @returns {number} Remaining actions
 */
export function getRemainingActions(action) {
  const tier = getLicenseTier();
  const limits = FEATURE_LIMITS[tier];

  if (!usageStats) {
    usageStats = createDefaultUsage();
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Reset if month changed
  if (usageStats.month !== currentMonth) {
    usageStats = createDefaultUsage();
  }

  if (action === 'save') {
    if (limits.maxSavesPerMonth === Infinity) {
      return Infinity;
    }
    return Math.max(0, limits.maxSavesPerMonth - usageStats.savesCount);
  }

  if (action === 'aiSummary') {
    if (limits.maxAiSummariesPerMonth === Infinity) {
      return Infinity;
    }
    return Math.max(0, limits.maxAiSummariesPerMonth - usageStats.aiSummariesCount);
  }

  return 0;
}

/**
 * Get usage statistics
 */
export function getUsageStats() {
  return { ...usageStats };
}

/**
 * Get license information
 */
export function getLicenseInfo() {
  return { ...licenseState };
}

/**
 * Get subscription information
 */
export function getSubscriptionInfo() {
  return { ...subscriptionInfo };
}

/**
 * Activate a license key
 * @param {string} licenseKey - License key to activate
 * @param {Object} options - Activation options
 * @returns {Promise<Object>} Activation result
 */
export async function activateLicense(licenseKey, options = {}) {
  const validatedKey = validateString(licenseKey, { 
    maxLength: 200, 
    allowEmpty: false,
    trim: true 
  });

  if (!validatedKey) {
    return { 
      success: false, 
      error: 'Invalid license key format',
      tier: FEATURE_TIERS.FREE 
    };
  }

  // In production, this would call your license server
  // For now, we'll implement a simple local validation
  const activationResult = await validateLicenseKeyLocally(validatedKey, options);

  if (activationResult.success) {
    licenseState = {
      ...activationResult.licenseData,
      licenseKey: validatedKey,
      isActive: true,
      activatedAt: new Date().toISOString(),
    };
    
    saveLicenseState(licenseState);
    
    // Save subscription info if provided
    if (options.subscription) {
      subscriptionInfo = options.subscription;
      saveSubscriptionInfo(subscriptionInfo);
    }
  }

  return activationResult;
}

/**
 * Validate license key locally (for development/testing)
 * In production, replace this with a call to your license server
 */
async function validateLicenseKeyLocally(licenseKey, options) {
  // This is a placeholder for local development
  // In production, you would call your license server API
  
  const config = getValidatedConfig();
  
  // If we have a license server URL, call it
  // For now, we'll use a simple pattern-based validation
  
  // Development keys (for testing)
  const devKeys = {
    'DEV-PRO-MONTHLY': { tier: FEATURE_TIERS.PRO_MONTHLY, expiresAt: getExpiryDate(30) },
    'DEV-PRO-ANNUAL': { tier: FEATURE_TIERS.PRO_ANNUAL, expiresAt: getExpiryDate(365) },
    'DEV-LIFETIME': { tier: FEATURE_TIERS.LIFETIME, expiresAt: null },
  };

  if (devKeys[licenseKey]) {
    return {
      success: true,
      licenseData: devKeys[licenseKey],
    };
  }

  // Check for Lemon Squeezy format (for production)
  // Lemon Squeezy license keys are typically in format: LICENSE-XXXX-XXXX-XXXX-XXXX
  const lemonSqueezyRegex = /^LICENSE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
  
  if (lemonSqueezyRegex.test(licenseKey)) {
    // In production, you would call your backend to validate
    // For now, we'll assume it's valid and return a temporary license
    console.warn('[Licensing] Lemon Squeezy key detected but not validated. In production, call your license server.');
    
    return {
      success: true,
      licenseData: {
        tier: FEATURE_TIERS.PRO_MONTHLY,
        expiresAt: getExpiryDate(30),
      },
    };
  }

  return {
    success: false,
    error: 'Invalid license key',
  };
}

/**
 * Get expiry date string
 * @param {number} days - Days until expiry
 * @returns {string} ISO date string
 */
function getExpiryDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Deactivate license
 */
export async function deactivateLicense() {
  licenseState = {
    tier: FEATURE_TIERS.FREE,
    licenseKey: null,
    isActive: false,
  };
  
  saveLicenseState(licenseState);
  subscriptionInfo = null;
  saveSubscriptionInfo(null);
  
  return { success: true };
}

/**
 * Check if license is active
 */
export function isLicenseActive() {
  return getLicenseTier() !== FEATURE_TIERS.FREE;
}

/**
 * Get upgrade URL for purchasing a license
 */
export function getUpgradeUrl(plan = 'pro_monthly') {
  const config = getValidatedConfig();
  
  // In production, this would be your Lemon Squeezy or Stripe checkout URL
  // For now, return a placeholder
  
  const planUrls = {
    pro_monthly: 'https://dopaqueue.com/pricing?plan=pro_monthly',
    pro_annual: 'https://dopaqueue.com/pricing?plan=pro_annual',
    lifetime: 'https://dopaqueue.com/pricing?plan=lifetime',
  };

  return planUrls[plan] || planUrls.pro_monthly;
}

/**
 * Get feature usage message for UI
 */
export function getFeatureUsageMessage(feature) {
  const tier = getLicenseTier();
  const limits = FEATURE_LIMITS[tier];
  const remaining = getRemainingActions(feature);

  if (limits[feature] === Infinity) {
    return null; // Unlimited
  }

  if (feature === 'save') {
    return `You have ${remaining} saves remaining this month`;
  }

  if (feature === 'aiSummary') {
    return `You have ${remaining} AI summaries remaining this month`;
  }

  return null;
}

// Export feature tiers for reference
export { FEATURE_TIERS, FEATURE_LIMITS };

export default {
  initLicensing,
  getLicenseTier,
  getFeatureLimits,
  hasFeature,
  canPerformAction,
  recordAction,
  getRemainingActions,
  getUsageStats,
  getLicenseInfo,
  getSubscriptionInfo,
  activateLicense,
  deactivateLicense,
  isLicenseActive,
  getUpgradeUrl,
  getFeatureUsageMessage,
  FEATURE_TIERS,
  FEATURE_LIMITS,
};
