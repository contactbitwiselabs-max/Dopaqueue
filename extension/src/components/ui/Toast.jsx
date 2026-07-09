import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

/**
 * Toast variants
 */
export const TOAST_VARIANTS = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Toast icons
 */
const TOAST_ICONS = {
  [TOAST_VARIANTS.SUCCESS]: CheckCircle,
  [TOAST_VARIANTS.ERROR]: XCircle,
  [TOAST_VARIANTS.WARNING]: AlertCircle,
  [TOAST_VARIANTS.INFO]: Info,
};

/**
 * Toast colors
 */
const TOAST_COLORS = {
  [TOAST_VARIANTS.SUCCESS]: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-500',
    text: 'text-green-800 dark:text-green-200',
    icon: 'text-green-500',
  },
  [TOAST_VARIANTS.ERROR]: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-500',
    text: 'text-red-800 dark:text-red-200',
    icon: 'text-red-500',
  },
  [TOAST_VARIANTS.WARNING]: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-500',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: 'text-yellow-500',
  },
  [TOAST_VARIANTS.INFO]: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-500',
    text: 'text-blue-800 dark:text-blue-200',
    icon: 'text-blue-500',
  },
};

/**
 * Toast context
 */
const ToastContext = createContext();

/**
 * Toast provider component
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = toast.id || Date.now().toString();
    const newToast = {
      ...toast,
      id,
      createdAt: Date.now(),
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    if (toast.duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    toasts,
    addToast,
    removeToast,
    clearToasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

/**
 * Toast container component
 */
const ToastContainer = () => {
  const { toasts, removeToast } = useContext(ToastContext);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[90vw]">
      {toasts.map((toast) => (
        <Toast 
          key={toast.id} 
          toast={toast} 
          onRemove={() => removeToast(toast.id)} 
        />
      ))}
    </div>
  );
};

/**
 * Individual toast component
 */
const Toast = ({ toast, onRemove }) => {
  const { variant = TOAST_VARIANTS.INFO, title, message, action } = toast;
  const colors = TOAST_COLORS[variant];
  const Icon = TOAST_ICONS[variant];

  return (
    <div
      className={twMerge(
        'flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg animate-in slide-in-from-bottom-2 duration-300',
        colors.bg,
        colors.border
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className={twMerge('flex-shrink-0', colors.icon)}>
        <Icon className="w-5 h-5" />
      </div>
      
      <div className="flex-1">
        {title && (
          <h4 className={twMerge('font-semibold mb-1', colors.text)}>
            {title}
          </h4>
        )}
        <p className={twMerge('text-sm', colors.text)}>
          {message}
        </p>
      </div>
      
      {action && (
        <button
          className="flex-shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
      
      <button
        className="flex-shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={onRemove}
        aria-label="Close"
      >
        <XCircle className="w-4 h-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
      </button>
    </div>
  );
};

/**
 * useToast hook
 */
export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const toast = useCallback((options) => {
    const { variant = TOAST_VARIANTS.INFO, title, message, duration, action, ...rest } = options;

    return context.addToast({
      variant,
      title,
      message,
      duration,
      action,
      ...rest,
    });
  }, [context.addToast]);

  const success = useCallback((message, options = {}) => {
    return toast({ variant: TOAST_VARIANTS.SUCCESS, message, ...options });
  }, [toast]);

  const error = useCallback((message, options = {}) => {
    return toast({ variant: TOAST_VARIANTS.ERROR, message, ...options });
  }, [toast]);

  const warning = useCallback((message, options = {}) => {
    return toast({ variant: TOAST_VARIANTS.WARNING, message, ...options });
  }, [toast]);

  const info = useCallback((message, options = {}) => {
    return toast({ variant: TOAST_VARIANTS.INFO, message, ...options });
  }, [toast]);

  return {
    toast,
    success,
    error,
    warning,
    info,
    clear: context.clearToasts,
  };
};

export default ToastProvider;
