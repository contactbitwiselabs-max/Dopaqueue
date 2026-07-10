// @ts-nocheck
// DopaQueue Error Handling System
// Centralized error management, logging, and reporting

/**
 * Error types for categorizing errors
 */
export const ERROR_TYPES = {
  // Network errors
  NETWORK: 'network',
  API: 'api',
  
  // Validation errors
  VALIDATION: 'validation',
  
  // Authentication errors
  AUTH: 'auth',
  LICENSE: 'license',
  
  // Storage errors
  STORAGE: 'storage',
  QUOTA: 'quota',
  
  // Scraping errors
  SCRAPING: 'scraping',
  TRANSCRIPT: 'transcript',
  
  // Payment errors
  PAYMENT: 'payment',
  
  // Configuration errors
  CONFIG: 'config',
  
  // Unknown errors
  UNKNOWN: 'unknown',
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
};

/**
 * DopaQueue Error class
 * Extends Error with additional metadata
 */
export class DopaQueueError extends Error {
  constructor(message, options = {}) {
    super(message);
    
    this.name = 'DopaQueueError';
    this.type = options.type || ERROR_TYPES.UNKNOWN;
    this.severity = options.severity || ERROR_SEVERITY.ERROR;
    this.code = options.code || null;
    this.context = options.context || {};
    this.timestamp = new Date().toISOString();
    this.isDopaQueueError = true;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DopaQueueError);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack ? this.stack.split('\n') : null,
    };
  }
  
  toString() {
    return `[${this.type}] ${this.message}`;
  }
}

/**
 * Network error class
 */
export class NetworkError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.NETWORK,
      severity: ERROR_SEVERITY.ERROR,
      ...options,
    });
    
    this.name = 'NetworkError';
    this.statusCode = options.statusCode || null;
    this.url = options.url || null;
  }
}

/**
 * API error class
 */
export class ApiError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.API,
      severity: ERROR_SEVERITY.ERROR,
      ...options,
    });
    
    this.name = 'ApiError';
    this.statusCode = options.statusCode || null;
    this.endpoint = options.endpoint || null;
    this.responseData = options.responseData || null;
  }
}

/**
 * Validation error class
 */
export class ValidationError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.VALIDATION,
      severity: ERROR_SEVERITY.WARN,
      ...options,
    });
    
    this.name = 'ValidationError';
    this.field = options.field || null;
    this.value = options.value || null;
    this.expected = options.expected || null;
  }
}

/**
 * Authentication error class
 */
export class AuthError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.AUTH,
      severity: ERROR_SEVERITY.ERROR,
      ...options,
    });
    
    this.name = 'AuthError';
    this.authType = options.authType || null;
  }
}

/**
 * License error class
 */
export class LicenseError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.LICENSE,
      severity: ERROR_SEVERITY.ERROR,
      ...options,
    });
    
    this.name = 'LicenseError';
    this.licenseKey = options.licenseKey || null;
    this.feature = options.feature || null;
  }
}

/**
 * Storage error class
 */
export class StorageError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.ERROR,
      ...options,
    });
    
    this.name = 'StorageError';
    this.key = options.key || null;
    this.quotaExceeded = options.quotaExceeded || false;
  }
}

/**
 * Scraping error class
 */
export class ScrapingError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.SCRAPING,
      severity: ERROR_SEVERITY.WARN,
      ...options,
    });
    
    this.name = 'ScrapingError';
    this.url = options.url || null;
    this.platform = options.platform || null;
    this.strategy = options.strategy || null;
    this.attempt = options.attempt || 1;
  }
}

/**
 * Transcript error class
 */
export class TranscriptError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.TRANSCRIPT,
      severity: ERROR_SEVERITY.WARN,
      ...options,
    });
    
    this.name = 'TranscriptError';
    this.videoId = options.videoId || null;
    this.reason = options.reason || null; // 'no_captions', 'private_video', 'rate_limited', etc.
  }
}

/**
 * Payment error class
 */
export class PaymentError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.PAYMENT,
      severity: ERROR_SEVERITY.ERROR,
      ...options,
    });
    
    this.name = 'PaymentError';
    this.provider = options.provider || null;
    this.plan = options.plan || null;
    this.paymentMethod = options.paymentMethod || null;
  }
}

/**
 * Configuration error class
 */
export class ConfigError extends DopaQueueError {
  constructor(message, options = {}) {
    super(message, {
      type: ERROR_TYPES.CONFIG,
      severity: ERROR_SEVERITY.CRITICAL,
      ...options,
    });
    
    this.name = 'ConfigError';
    this.missingConfig = options.missingConfig || [];
  }
}

/**
 * Error logger
 * Centralized logging for errors
 */
class ErrorLogger {
  constructor() {
    this.errors = [];
    this.maxErrors = 100; // Keep last 100 errors in memory
  }
  
  log(error, context = {}) {
    // Normalize error to DopaQueueError
    let dopaQueueError;
    
    if (error instanceof DopaQueueError) {
      dopaQueueError = error;
    } else if (error instanceof Error) {
      dopaQueueError = new DopaQueueError(error.message, {
        type: ERROR_TYPES.UNKNOWN,
        context,
      });
    } else {
      dopaQueueError = new DopaQueueError(String(error), {
        type: ERROR_TYPES.UNKNOWN,
        context,
      });
    }
    
    // Add additional context
    dopaQueueError.context = { ...dopaQueueError.context, ...context };
    
    // Store error
    this.errors.push(dopaQueueError);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    
    // Log to console based on severity
    this.logToConsole(dopaQueueError);
    
    // In extension, also log to chrome.runtime.lastError for debugging
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.lastError = dopaQueueError;
    }
    
    return dopaQueueError;
  }
  
  logToConsole(error) {
    const timestamp = new Date().toISOString();
    
    switch (error.severity) {
      case ERROR_SEVERITY.DEBUG:
        console.debug(`[${timestamp}] [${error.type}] ${error.message}`, error.context);
        break;
      case ERROR_SEVERITY.INFO:
        console.info(`[${timestamp}] [${error.type}] ${error.message}`, error.context);
        break;
      case ERROR_SEVERITY.WARN:
        console.warn(`[${timestamp}] [${error.type}] ${error.message}`, error.context);
        break;
      case ERROR_SEVERITY.ERROR:
        console.error(`[${timestamp}] [${error.type}] ${error.message}`, error.context, error.stack);
        break;
      case ERROR_SEVERITY.CRITICAL:
        console.error(`[${timestamp}] [${error.type}] CRITICAL: ${error.message}`, error.context, error.stack);
        break;
      default:
        console.log(`[${timestamp}] [${error.type}] ${error.message}`, error.context);
    }
  }
  
  getErrors(filter = {}) {
    let errors = [...this.errors];
    
    if (filter.type) {
      errors = errors.filter(e => e.type === filter.type);
    }
    
    if (filter.severity) {
      errors = errors.filter(e => e.severity === filter.severity);
    }
    
    if (filter.since) {
      const sinceDate = new Date(filter.since);
      errors = errors.filter(e => new Date(e.timestamp) >= sinceDate);
    }
    
    return errors;
  }
  
  clear() {
    this.errors = [];
  }
  
  getStats() {
    const counts = {
      total: this.errors.length,
      byType: {},
      bySeverity: {},
    };
    
    for (const error of this.errors) {
      counts.byType[error.type] = (counts.byType[error.type] || 0) + 1;
      counts.bySeverity[error.severity] = (counts.bySeverity[error.severity] || 0) + 1;
    }
    
    return counts;
  }
}

// Singleton error logger
export const errorLogger = new ErrorLogger();

/**
 * Create error handlers for different contexts
 */

/**
 * Create an async function wrapper with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Options
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, options = {}) {
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      errorLogger.log(error, {
        function: fn.name,
        args: args.map(arg => typeof arg === 'object' ? '[Object]' : arg),
        ...options.context,
      });
      
      // Re-throw if not supposed to swallow
      if (!options.swallow) {
        throw error;
      }
      
      return options.defaultValue;
    }
  };
}

/**
 * Create a sync function wrapper with error handling
 * @param {Function} fn - Sync function to wrap
 * @param {Object} options - Options
 * @returns {Function} Wrapped function
 */
export function withSyncErrorHandling(fn, options = {}) {
  return function(...args) {
    try {
      return fn(...args);
    } catch (error) {
      errorLogger.log(error, {
        function: fn.name,
        args: args.map(arg => typeof arg === 'object' ? '[Object]' : arg),
        ...options.context,
      });
      
      if (!options.swallow) {
        throw error;
      }
      
      return options.defaultValue;
    }
  };
}

/**
 * User-friendly error messages
 * Maps technical errors to user-friendly messages
 */
const USER_FRIENDLY_MESSAGES = {
  // Network errors
  [ERROR_TYPES.NETWORK]: {
    default: 'Network error. Please check your internet connection.',
    timeout: 'Request timed out. Please try again.',
    offline: 'You are offline. Please check your internet connection.',
  },
  
  // API errors
  [ERROR_TYPES.API]: {
    default: 'Service error. Please try again later.',
    rate_limited: 'Too many requests. Please wait a moment and try again.',
    not_found: 'Resource not found.',
    unauthorized: 'Please sign in to continue.',
    forbidden: 'You do not have permission to perform this action.',
  },
  
  // Validation errors
  [ERROR_TYPES.VALIDATION]: {
    default: 'Invalid input. Please check your data.',
    invalid_url: 'Please enter a valid URL.',
    invalid_email: 'Please enter a valid email address.',
    required: 'This field is required.',
    too_long: 'Input is too long.',
  },
  
  // Authentication errors
  [ERROR_TYPES.AUTH]: {
    default: 'Authentication error. Please sign in again.',
    invalid_credentials: 'Invalid email or password.',
    expired: 'Your session has expired. Please sign in again.',
    revoked: 'Your access has been revoked.',
  },
  
  // License errors
  [ERROR_TYPES.LICENSE]: {
    default: 'License error.',
    invalid: 'Invalid license key.',
    expired: 'Your license has expired.',
    revoked: 'Your license has been revoked.',
    feature_locked: 'This feature requires a Pro subscription.',
    limit_reached: 'You have reached your monthly limit for this feature.',
  },
  
  // Storage errors
  [ERROR_TYPES.STORAGE]: {
    default: 'Storage error. Please try again.',
    quota_exceeded: 'Storage quota exceeded. Please free up some space.',
    not_found: 'Data not found.',
  },
  
  // Scraping errors
  [ERROR_TYPES.SCRAPING]: {
    default: 'Could not retrieve video information.',
    no_metadata: 'No metadata found for this video.',
    private: 'This video is private or unavailable.',
    blocked: 'Access to this video is blocked.',
  },
  
  // Transcript errors
  [ERROR_TYPES.TRANSCRIPT]: {
    default: 'Could not retrieve transcript.',
    no_captions: 'No captions available for this video.',
    auto_generated: 'Auto-generated captions are not available.',
    owner_only: 'Captions are only available to the video owner.',
    rate_limited: 'Too many transcript requests. Please try again later.',
  },
  
  // Payment errors
  [ERROR_TYPES.PAYMENT]: {
    default: 'Payment processing error.',
    declined: 'Payment declined. Please check your payment details.',
    cancelled: 'Payment cancelled.',
    failed: 'Payment failed. Please try again.',
  },
  
  // Configuration errors
  [ERROR_TYPES.CONFIG]: {
    default: 'Configuration error. Please check your settings.',
    missing: 'Required configuration is missing.',
  },
  
  // Unknown errors
  [ERROR_TYPES.UNKNOWN]: {
    default: 'An unexpected error occurred. Please try again.',
  },
};

/**
 * Get user-friendly error message
 * @param {Error} error - Error to convert
 * @returns {string} User-friendly message
 */
export function getUserFriendlyMessage(error) {
  if (!error) {
    return 'An error occurred.';
  }
  
  const type = error.type || ERROR_TYPES.UNKNOWN;
  const messages = USER_FRIENDLY_MESSAGES[type];
  
  if (!messages) {
    return USER_FRIENDLY_MESSAGES[ERROR_TYPES.UNKNOWN].default;
  }
  
  // Check for specific error codes
  if (error.code && messages[error.code]) {
    return messages[error.code];
  }
  
  // Return default message for this type
  return messages.default || USER_FRIENDLY_MESSAGES[ERROR_TYPES.UNKNOWN].default;
}

/**
 * Create a user-friendly error response
 * @param {Error} error - Error to convert
 * @returns {Object} User-friendly error response
 */
export function createUserFriendlyError(error) {
  return {
    message: getUserFriendlyMessage(error),
    type: error.type || ERROR_TYPES.UNKNOWN,
    severity: error.severity || ERROR_SEVERITY.ERROR,
    recoverable: error.severity !== ERROR_SEVERITY.CRITICAL,
    details: error.context || {},
  };
}

/**
 * Error boundary component for React
 * Usage: <ErrorBoundary><Component /></ErrorBoundary>
 */
export class ErrorBoundary extends HTMLElement {
  constructor() {
    super();
    this.state = { hasError: false, error: null };
  }
  
  static get observedAttributes() {
    return ['fallback'];
  }
  
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'fallback') {
      this.render();
    }
  }
  
  render() {
    if (this.state.hasError) {
      const fallback = this.getAttribute('fallback') || 'An error occurred.';
      this.shadowRoot.innerHTML = `<div class="dq-error-boundary">${fallback}</div>`;
    } else {
      this.shadowRoot.innerHTML = '<slot></slot>';
    }
  }
  
  // This is a simplified version - in React, you'd use a React component
}

/**
 * React Error Boundary Component
 * Usage: <ErrorBoundary fallback={<div>Error!</div>}>
 *          <Component />
 *        </ErrorBoundary>
 */
export function createReactErrorBoundary(React) {
  return class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
      // Log error to error logger
      errorLogger.log(error, {
        component: this.props.componentName,
        errorInfo,
      });
      
      // You can also log to an error reporting service
      if (this.props.onError) {
        this.props.onError(error, errorInfo);
      }
    }
    
    render() {
      if (this.state.hasError) {
        if (this.props.fallback) {
          return this.props.fallback;
        }
        return <div className="dq-error-boundary">Something went wrong.</div>;
      }
      return this.props.children;
    }
  };
}

export default {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DopaQueueError,
  NetworkError,
  ApiError,
  ValidationError,
  AuthError,
  LicenseError,
  StorageError,
  ScrapingError,
  TranscriptError,
  PaymentError,
  ConfigError,
  errorLogger,
  withErrorHandling,
  withSyncErrorHandling,
  getUserFriendlyMessage,
  createUserFriendlyError,
  createReactErrorBoundary,
};
