// DopaQueue Payment Integration
// Handles communication with payment processors (Lemon Squeezy, Stripe)

import { getValidatedConfig } from './config.js';
import { validateString, validateUrl } from './validation.js';

/**
 * Payment provider types
 */
export const PAYMENT_PROVIDERS = {
  LEMON_SQUEEZY: 'lemon_squeezy',
  STRIPE: 'stripe',
  TEST: 'test',
};

/**
 * Product/Plan IDs
 * These should match your Lemon Squeezy or Stripe product IDs
 */
export const PRODUCT_IDS = {
  // Pro Monthly
  PRO_MONTHLY: process.env.VITE_LEMONSQUEEZY_PRO_MONTHLY || 'pro_monthly',
  
  // Pro Annual
  PRO_ANNUAL: process.env.VITE_LEMONSQUEEZY_PRO_ANNUAL || 'pro_annual',
  
  // Lifetime
  LIFETIME: process.env.VITE_LEMONSQUEEZY_LIFETIME || 'lifetime',
};

/**
 * Price IDs (for Stripe)
 */
export const PRICE_IDS = {
  PRO_MONTHLY: process.env.VITE_STRIPE_PRO_MONTHLY_PRICE || '',
  PRO_ANNUAL: process.env.VITE_STRIPE_PRO_ANNUAL_PRICE || '',
  LIFETIME: process.env.VITE_STRIPE_LIFETIME_PRICE || '',
};

// API endpoints
const API_ENDPOINTS = {
  [PAYMENT_PROVIDERS.LEMON_SQUEEZY]: {
    checkout: 'https://api.lemonsqueezy.com/v1/checkouts',
    licenses: 'https://api.lemonsqueezy.com/v1/licenses',
  },
  [PAYMENT_PROVIDERS.STRIPE]: {
    checkout: 'https://api.stripe.com/v1/checkout/sessions',
  },
};

/**
 * Get current payment provider from config
 */
export function getPaymentProvider() {
  const config = getValidatedConfig();
  const provider = config.PAYMENT_PROVIDER || PAYMENT_PROVIDERS.LEMON_SQUEEZY;
  
  if (Object.values(PAYMENT_PROVIDERS).includes(provider)) {
    return provider;
  }
  
  return PAYMENT_PROVIDERS.LEMON_SQUEEZY;
}

/**
 * Get API key for payment provider
 */
export function getPaymentApiKey() {
  const config = getValidatedConfig();
  const provider = getPaymentProvider();
  
  if (provider === PAYMENT_PROVIDERS.LEMON_SQUEEZY) {
    return config.LEMON_SQUEEZY_API_KEY || '';
  }
  
  if (provider === PAYMENT_PROVIDERS.STRIPE) {
    return config.STRIPE_PUBLISHABLE_KEY || '';
  }
  
  return '';
}

/**
 * Create a checkout session for purchasing a subscription
 * @param {string} plan - Plan ID (PRO_MONTHLY, PRO_ANNUAL, LIFETIME)
 * @param {Object} options - Checkout options
 * @returns {Promise<Object>} Checkout session data
 */
export async function createCheckoutSession(plan, options = {}) {
  const provider = getPaymentProvider();
  
  if (provider === PAYMENT_PROVIDERS.TEST) {
    // Test mode - return mock data
    return createTestCheckoutSession(plan, options);
  }
  
  if (provider === PAYMENT_PROVIDERS.LEMON_SQUEEZY) {
    return createLemonSqueezyCheckout(plan, options);
  }
  
  if (provider === PAYMENT_PROVIDERS.STRIPE) {
    return createStripeCheckout(plan, options);
  }
  
  throw new Error(`Unsupported payment provider: ${provider}`);
}

/**
 * Create Lemon Squeezy checkout
 */
async function createLemonSqueezyCheckout(plan, options = {}) {
  const config = getValidatedConfig();
  const apiKey = config.LEMON_SQUEEZY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Lemon Squeezy API key not configured');
  }
  
  const productId = PRODUCT_IDS[plan];
  if (!productId) {
    throw new Error(`Invalid plan: ${plan}`);
  }
  
  // Get customer email if available
  const customerEmail = options.email || '';
  
  // Custom success URL
  const successUrl = validateUrl(options.successUrl) || 
    validateUrl(config.SHARE_BASE_URL) || 
    'http://localhost:3000/success';
  
  const errorUrl = validateUrl(options.errorUrl) || 
    validateUrl(config.SHARE_BASE_URL) || 
    'http://localhost:3000/error';

  try {
    const response = await fetch(API_ENDPOINTS[PAYMENT_PROVIDERS.LEMON_SQUEEZY].checkout, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        variant_id: plan, // Lemon Squeezy uses variant_id for different pricing
        customer_email: customerEmail,
        success_url: successUrl,
        error_url: errorUrl,
        custom: {
          source: 'dopaqueue_extension',
          version: '1.0',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Lemon Squeezy API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      provider: PAYMENT_PROVIDERS.LEMON_SQUEEZY,
      checkoutUrl: data.data.attributes.url,
      checkoutId: data.data.id,
      plan,
    };
  } catch (error) {
    console.error('[Payments] Lemon Squeezy checkout error:', error);
    throw error;
  }
}

/**
 * Create Stripe checkout
 */
async function createStripeCheckout(plan, options = {}) {
  const config = getValidatedConfig();
  const apiKey = config.STRIPE_SECRET_KEY; // Note: This should be server-side only
  
  if (!apiKey) {
    throw new Error('Stripe API key not configured');
  }
  
  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    throw new Error(`Invalid plan: ${plan}`);
  }
  
  const successUrl = validateUrl(options.successUrl) || 
    validateUrl(config.SHARE_BASE_URL) || 
    'http://localhost:3000/success';
  
  const cancelUrl = validateUrl(options.errorUrl) || 
    validateUrl(config.SHARE_BASE_URL) || 
    'http://localhost:3000/error';

  try {
    const response = await fetch(API_ENDPOINTS[PAYMENT_PROVIDERS.STRIPE].checkout, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: plan === PRODUCT_IDS.LIFETIME ? 'payment' : 'subscription',
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: options.email || undefined,
        metadata: {
          source: 'dopaqueue_extension',
          version: '1.0',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Stripe API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      provider: PAYMENT_PROVIDERS.STRIPE,
      checkoutUrl: data.url,
      sessionId: data.id,
      plan,
    };
  } catch (error) {
    console.error('[Payments] Stripe checkout error:', error);
    throw error;
  }
}

/**
 * Create test checkout session (for development)
 */
async function createTestCheckoutSession(plan, options = {}) {
  // In test mode, we'll simulate the checkout process
  console.log('[Payments] Test mode: Creating mock checkout session for plan:', plan);
  
  // Generate a mock checkout URL
  const mockCheckoutUrl = `https://test-payment-provider.com/checkout?plan=${plan}&test=true`;
  
  return {
    provider: PAYMENT_PROVIDERS.TEST,
    checkoutUrl: mockCheckoutUrl,
    checkoutId: `test_${Date.now()}`,
    plan,
    test: true,
  };
}

/**
 * Verify a license key with the payment provider
 * @param {string} licenseKey - License key to verify
 * @returns {Promise<Object>} Verification result
 */
export async function verifyLicenseKey(licenseKey) {
  const provider = getPaymentProvider();
  
  if (provider === PAYMENT_PROVIDERS.TEST) {
    return verifyTestLicenseKey(licenseKey);
  }
  
  if (provider === PAYMENT_PROVIDERS.LEMON_SQUEEZY) {
    return verifyLemonSqueezyLicense(licenseKey);
  }
  
  if (provider === PAYMENT_PROVIDERS.STRIPE) {
    return verifyStripeLicense(licenseKey);
  }
  
  throw new Error(`Unsupported payment provider: ${provider}`);
}

/**
 * Verify Lemon Squeezy license
 */
async function verifyLemonSqueezyLicense(licenseKey) {
  const config = getValidatedConfig();
  const apiKey = config.LEMON_SQUEEZY_API_KEY;
  
  if (!apiKey) {
    throw new Error('Lemon Squeezy API key not configured');
  }
  
  try {
    const response = await fetch(`${API_ENDPOINTS[PAYMENT_PROVIDERS.LEMON_SQUEEZY].licenses}/${licenseKey}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false, error: 'License key not found' };
      }
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Lemon Squeezy API error: ${response.status}`);
    }

    const data = await response.json();
    const licenseData = data.data.attributes;
    
    // Map Lemon Squeezy status to our status
    const isActive = licenseData.status === 'active' || licenseData.status === 'expired';
    
    return {
      valid: isActive,
      licenseKey,
      customerId: licenseData.customer_id,
      customerEmail: licenseData.customer_email,
      status: licenseData.status,
      productId: licenseData.product_id,
      variantId: licenseData.variant_id,
      expiresAt: licenseData.expires_at,
      createdAt: licenseData.created_at,
      updatedAt: licenseData.updated_at,
    };
  } catch (error) {
    console.error('[Payments] Lemon Squeezy license verification error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Verify Stripe license (subscription)
 */
async function verifyStripeLicense(licenseKey) {
  // Stripe uses subscription IDs or customer IDs, not license keys
  // This is a placeholder for Stripe integration
  console.warn('[Payments] Stripe license verification not fully implemented');
  
  return {
    valid: false,
    error: 'Stripe license verification not implemented',
  };
}

/**
 * Verify test license key
 */
async function verifyTestLicenseKey(licenseKey) {
  // In test mode, accept specific test keys
  const testKeys = {
    'TEST-PRO-MONTHLY': {
      valid: true,
      tier: 'pro_monthly',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    'TEST-PRO-ANNUAL': {
      valid: true,
      tier: 'pro_annual',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    'TEST-LIFETIME': {
      valid: true,
      tier: 'lifetime',
      expiresAt: null,
    },
  };

  if (testKeys[licenseKey]) {
    return { ...testKeys[licenseKey], licenseKey };
  }

  // Accept any key in test mode for development
  if (licenseKey.startsWith('TEST-')) {
    return {
      valid: true,
      licenseKey,
      tier: 'pro_monthly',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      test: true,
    };
  }

  return { valid: false, error: 'Invalid test license key' };
}

/**
 * Get pricing information for all plans
 */
export function getPricingInfo() {
  return {
    plans: [
      {
        id: PRODUCT_IDS.PRO_MONTHLY,
        name: 'Pro Monthly',
        price: '$4.99/month',
        priceValue: 4.99,
        period: 'month',
        features: [
          'Unlimited video saves',
          '50 AI summaries/month',
          'Cloud sync',
          'Advanced export (Markdown, CSV, JSON)',
          'Custom templates',
          'Analytics dashboard',
        ],
        popular: false,
      },
      {
        id: PRODUCT_IDS.PRO_ANNUAL,
        name: 'Pro Annual',
        price: '$49/year',
        priceValue: 49,
        period: 'year',
        savings: '$99 saved vs monthly',
        features: [
          'Unlimited video saves',
          '500 AI summaries/month',
          'Cloud sync',
          'Team sync (3 members)',
          'Advanced export',
          'Custom templates',
          'Analytics dashboard',
          'Priority support',
        ],
        popular: true,
      },
      {
        id: PRODUCT_IDS.LIFETIME,
        name: 'Lifetime',
        price: '$99 (one-time)',
        priceValue: 99,
        period: 'lifetime',
        features: [
          'Unlimited video saves',
          'Unlimited AI summaries',
          'Cloud sync',
          'Team sync (10 members)',
          'All advanced features',
          'Priority support',
          'All future updates',
        ],
        popular: false,
      },
    ],
    currency: 'USD',
  };
}

/**
 * Get current subscription status
 * @returns {Promise<Object>} Subscription status
 */
export async function getSubscriptionStatus() {
  // In a real implementation, this would call your backend
  // to check the subscription status with the payment provider
  
  // For now, return mock data
  return {
    hasActiveSubscription: false,
    plan: null,
    status: 'none',
    expiresAt: null,
    trialEndsAt: null,
  };
}

/**
 * Cancel subscription
 * @returns {Promise<Object>} Cancellation result
 */
export async function cancelSubscription() {
  // In a real implementation, this would call your backend
  // to cancel the subscription with the payment provider
  
  console.warn('[Payments] Subscription cancellation not implemented');
  
  return {
    success: false,
    error: 'Subscription cancellation not implemented',
  };
}

/**
 * Manage subscription (open customer portal)
 * @returns {Promise<Object>} Portal URL
 */
export async function manageSubscription() {
  const provider = getPaymentProvider();
  
  if (provider === PAYMENT_PROVIDERS.LEMON_SQUEEZY) {
    // Lemon Squeezy customer portal
    const config = getValidatedConfig();
    const customerEmail = ''; // Would get from user session
    
    // This is a placeholder - in production, you'd need the customer's
    // Lemon Squeezy customer ID
    return {
      portalUrl: `https://my.lemonsqueezy.com/customer-portal`,
    };
  }
  
  if (provider === PAYMENT_PROVIDERS.STRIPE) {
    // Stripe customer portal
    return {
      portalUrl: `https://billing.stripe.com/portal`,
    };
  }
  
  return { portalUrl: null };
}

export default {
  PAYMENT_PROVIDERS,
  PRODUCT_IDS,
  PRICE_IDS,
  getPaymentProvider,
  getPaymentApiKey,
  createCheckoutSession,
  verifyLicenseKey,
  getPricingInfo,
  getSubscriptionStatus,
  cancelSubscription,
  manageSubscription,
};
