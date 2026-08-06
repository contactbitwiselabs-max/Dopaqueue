// DopaQueue Licensing System
// Handles license verification, feature gating, and subscription management

import { getValidatedConfig } from './config.js';
import { validateString } from './validation.js';
import { STORAGE_KEYS as CORE_KEYS } from './constants.js';

// Feature tiers
const FEATURE_TIERS = {
  FREE: 'free',
  PRO_MONTHLY: 'pro_monthly',
  PRO_ANNUAL: 'pro_annual',
  LIFETIME: 'lifetime',
};

// Feature limits by tier
interface FeatureLimits {
  maxSavesPerMonth: number;
  maxAiSummariesPerMonth: number;
  cloudSync: boolean;
  teamSync: boolean;
  advancedExport: boolean;
  customTemplates: boolean;
  analytics: boolean;
  prioritySupport: boolean;
  maxTeamMembers: number;
  tier: string;
  [key: string]: any; // Allow dynamic indexing
}

const FEATURE_LIMITS: Record<string, FeatureLimits> = {
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
    tier: FEATURE_TIERS.FREE,
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
    tier: FEATURE_TIERS.PRO_MONTHLY,
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
    tier: FEATURE_TIERS.PRO_ANNUAL,
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
    tier: FEATURE_TIERS.LIFETIME,
  },
};

// Storage keys
// C20: Re-use the canonical STORAGE_KEYS from constants so a rename in one
// place doesn't silently desync the other. Falls back to legacy keys only
// if the constants module is unavailable (e.g. during isolated unit tests).
const STORAGE_KEYS = {
  LICENSE: CORE_KEYS?.LICENSE || 'dq_license',
  USAGE: CORE_KEYS?.USAGE || 'dq_usage',
  SUBSCRIPTION: CORE_KEYS?.SUBSCRIPTION || 'dq_subscription',
};

// In-memory state
interface LicenseState {
  tier: string;
  licenseKey: string;
  customerId: string;
  email: string;
  activatedAt: string;
  expiresAt: string | null;
  isActive: boolean;
}

interface UsageStats {
  month: string;
  savesCount: number;
  aiSummariesCount: number;
  lastReset: string;
}

interface SubscriptionInfo {
  subscription: any;
}

let licenseState: LicenseState | null = null;
let usageStats: UsageStats | null = null;
let subscriptionInfo: SubscriptionInfo | null = null;

/**
 * Initialize licensing system
 */
export async function initLicensing(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    // Node.js environment (server)
    return;
  }

  return new Promise<void>((resolve) => {
    chrome.storage.local.get([
      STORAGE_KEYS.LICENSE,
      STORAGE_KEYS.USAGE,
      STORAGE_KEYS.SUBSCRIPTION,
    ], (res) => {
      if (chrome.runtime.lastError) {
        console.error('[Licensing] Error loading license data:', chrome.runtime.lastError);
      }

      licenseState = (res[STORAGE_KEYS.LICENSE] as LicenseState) || null;
      usageStats = (res[STORAGE_KEYS.USAGE] as UsageStats) || createDefaultUsage();
      subscriptionInfo = (res[STORAGE_KEYS.SUBSCRIPTION] as SubscriptionInfo) || null;

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
  ensureFreshUsage();
}

/**
 * Validate license state
 */
function validateLicenseState(state: LicenseState | null): LicenseState | null {
  if (!state || typeof state !== 'object') {
    return null;
  }

  const validated: Partial<LicenseState> = {};

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

  return validated as LicenseState;
}

/**
 * Validate usage stats
 */
function validateUsageStats(stats: UsageStats | null): UsageStats {
  if (!stats || typeof stats !== 'object') {
    return createDefaultUsage();
  }

  const validated: UsageStats = {
    month: stats.month || createDefaultUsage().month,
    savesCount: Math.max(0, Math.floor(stats.savesCount || 0)),
    aiSummariesCount: Math.max(0, Math.floor(stats.aiSummariesCount || 0)),
    lastReset: stats.lastReset || createDefaultUsage().lastReset,
  };

  return validated;
}

/**
 * Current month key in 'YYYY-MM' format. Centralized so all sites agree
 * even after long sleeps that cross month/year boundaries.
 */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * B10: Ensures usageStats reflects the current month. Safe to call repeatedly.
 * Detects year-cross rollover, day-cross rollover, and stale state after long
 * SW suspension (where the in-memory month key may be months behind reality).
 */
export function ensureFreshUsage(): void {
  if (!usageStats) {
    usageStats = createDefaultUsage();
    return;
  }
  const nowKey = currentMonthKey();
  if (usageStats.month !== nowKey) {
    usageStats = createDefaultUsage();
    saveUsageStats(usageStats);
  }
}

/**
 * Save license state
 */
function saveLicenseState(state: LicenseState | null): void {
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
function saveUsageStats(stats: UsageStats): void {
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
function saveSubscriptionInfo(info: SubscriptionInfo | null): void {
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
export function getLicenseTier(): string {
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
export function hasFeature(feature: string): boolean {
  const limits = getFeatureLimits() as FeatureLimits;
  return Boolean(limits[feature]);
}

/**
 * Check if user can perform an action (respecting limits)
 * @param {string} action - Action type ('save' or 'aiSummary')
 * @returns {boolean} True if action is allowed
 */
export function canPerformAction(action: string): boolean {
  const tier = getLicenseTier();
  const limits = FEATURE_LIMITS[tier] as FeatureLimits;

  // Check monthly limits
  if (action === 'save') {
    if (limits.maxSavesPerMonth === Infinity) {
      return true;
    }
    return (usageStats?.savesCount ?? 0) < limits.maxSavesPerMonth;
  }

  if (action === 'aiSummary') {
    if (limits.maxAiSummariesPerMonth === Infinity) {
      return true;
    }
    return (usageStats?.aiSummariesCount ?? 0) < limits.maxAiSummariesPerMonth;
  }

  return true;
}

/**
 * Record an action (increment usage counter)
 * @param {string} action - Action type ('save' or 'aiSummary')
 * @returns {boolean} True if action was recorded
 */
export function recordAction(action: string): boolean {
  // B10: shared helper handles stale state, year-cross rollover, and month reset
  ensureFreshUsage();
  
  // usageStats is guaranteed to be non-null after ensureFreshUsage()
  if (!usageStats) return false;

  if (action === 'save') {
    usageStats.savesCount++;
  } else if (action === 'aiSummary') {
    usageStats.aiSummariesCount++;
  }

  usageStats.lastReset = new Date().toISOString();
  saveUsageStats(usageStats);
  return true;
}

/**
 * Get remaining actions for the current month
 * @param {string} action - Action type ('save' or 'aiSummary')
 * @returns {number} Remaining actions
 */
export function getRemainingActions(action: string): number {
  const tier = getLicenseTier();
  const limits = FEATURE_LIMITS[tier] as FeatureLimits;

  // B10: shared helper
  ensureFreshUsage();

  if (action === 'save') {
    if (limits.maxSavesPerMonth === Infinity) {
      return Infinity;
    }
    return Math.max(0, limits.maxSavesPerMonth - (usageStats?.savesCount ?? 0));
  }

  if (action === 'aiSummary') {
    if (limits.maxAiSummariesPerMonth === Infinity) {
      return Infinity;
    }
    return Math.max(0, limits.maxAiSummariesPerMonth - (usageStats?.aiSummariesCount ?? 0));
  }

  return 0;
}

/**
 * Get usage statistics
 */
export function getUsageStats(): UsageStats {
  return { ...usageStats } as UsageStats;
}

/**
 * Get license information
 */
export function getLicenseInfo(): LicenseState | null {
  return licenseState ? { ...licenseState } : null;
}

/**
 * Get subscription information
 */
export function getSubscriptionInfo(): SubscriptionInfo | null {
  return subscriptionInfo ? { ...subscriptionInfo } : null;
}

/**
 * Activate a license key
 * @param {string} licenseKey - License key to activate
 * @param {Object} options - Activation options
 * @returns {Promise<Object>} Activation result
 */
export async function activateLicense(licenseKey: string, options: any = {}): Promise<any> {
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
    } as LicenseState;
    
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
  async function validateLicenseKeyLocally(licenseKey: string, options: any): Promise<any> {
    // This is a placeholder for local development
    // In production, you would call your license server API
  
    const config = getValidatedConfig();
  
      // S6: In production/staging builds, DEV keys are a security risk — disable them.
      // Only allow during local development.
      const isProduction = config.ENVIRONMENT === 'production' || config.ENVIRONMENT === 'staging'
        || (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.MODE === 'production');
  
    // Development keys (for testing ONLY — disabled in production)
    if (!isProduction) {
      const devKeys: Record<string, any> = {
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
    }

    // Check for Lemon Squeezy format (for production)
      // Lemon Squeezy license keys are typically in format: LICENSE-XXXX-XXXX-XXXX-XXXX
      const lemonSqueezyRegex = /^LICENSE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
  
      if (lemonSqueezyRegex.test(licenseKey)) {
        // S6: In production/staging, never trust client-side license key validation.
        // This must call the license server to verify. For dev mode only, warn and proceed.
        if (isProduction) {
          console.warn('[Licensing] Lemon Squeezy keys must be validated server-side in production. Deployment may require a license server endpoint.');
          return {
            success: false,
            error: 'License validation requires server connection. Please connect your license server.',
            tier: FEATURE_TIERS.FREE,
          };
        }
   
        // Dev/staging only: trust format and return a temporary license for local testing
        console.warn('[Licensing] Lemon Squeezy key detected in dev mode — trusted locally. Production would require server validation.');
   
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
  function getExpiryDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  /**
   * Deactivate license
   */
  export async function deactivateLicense(): Promise<void> {
    licenseState = {
      tier: FEATURE_TIERS.FREE,
      licenseKey: '',
      customerId: '',
      email: '',
      activatedAt: '',
      expiresAt: null,
      isActive: false,
    } as LicenseState;

    saveLicenseState(licenseState);
    subscriptionInfo = { subscription: null };
    saveSubscriptionInfo(subscriptionInfo);
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
export function getUpgradeUrl(plan: string = 'pro_monthly'): string {
  const config = getValidatedConfig();
  
  // In production, this would be your Lemon Squeezy or Stripe checkout URL
  // For now, return a placeholder
  
  const planUrls: Record<string, string> = {
    pro_monthly: 'https://dopaqueue.com/pricing?plan=pro_monthly',
    pro_annual: 'https://dopaqueue.com/pricing?plan=pro_annual',
    lifetime: 'https://dopaqueue.com/pricing?plan=lifetime',
  };
  
  return planUrls[plan] || planUrls.pro_monthly;
}

/**
 * Get feature usage message for UI
 */
export function getFeatureUsageMessage(feature: string): string | null {
  const tier = getLicenseTier();
  const limits = FEATURE_LIMITS[tier] as FeatureLimits;
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
