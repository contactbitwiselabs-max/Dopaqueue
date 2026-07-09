import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Loading spinner component
 * 
 * @param {Object} props - Component props
 * @param {'sm' | 'md' | 'lg' | 'xl'} props.size - Spinner size
 * @param {string} props.variant - Spinner variant ('primary', 'secondary', 'white')
 * @param {string} props.label - Accessible label
 * @param {string} props.className - Additional classes
 */
export const Spinner = ({
  size = 'md',
  variant = 'primary',
  label = 'Loading',
  className = '',
}) => {
  // Size styles
  const sizeStyles = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  };

  // Variant styles
  const variantStyles = {
    primary: 'border-blue-600 border-t-transparent',
    secondary: 'border-gray-600 border-t-transparent',
    white: 'border-white border-t-transparent',
  };

  // Merge all styles
  const mergedClassName = twMerge(
    'animate-spin rounded-full',
    sizeStyles[size],
    variantStyles[variant],
    className
  );

  return (
    <div role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <svg className={mergedClassName} viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

/**
 * Loading overlay component
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Loading message
 * @param {boolean} props.isVisible - Whether overlay is visible
 * @param {string} props.className - Additional classes
 */
export const LoadingOverlay = ({
  message = 'Loading...',
  isVisible = true,
  className = '',
}) => {
  if (!isVisible) return null;

  return (
    <div
      className={twMerge(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center justify-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-xl">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {message}
        </p>
      </div>
    </div>
  );
};

/**
 * Skeleton loading component
 * 
 * @param {Object} props - Component props
 * @param {'text' | 'circular' | 'rectangular'} props.variant - Skeleton variant
 * @param {string} props.width - Width (for rectangular variant)
 * @param {string} props.height - Height (for rectangular/circular variants)
 * @param {string} props.className - Additional classes
 */
export const Skeleton = ({
  variant = 'text',
  width,
  height,
  className = '',
}) => {
  // Base styles
  const baseStyles = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

  // Variant styles
  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };

  // Merge all styles
  const mergedClassName = twMerge(
    baseStyles,
    variantStyles[variant],
    className
  );

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={mergedClassName}
      style={style}
      role="status"
      aria-label="Loading"
    />
  );
};

/**
 * Skeleton text component
 * 
 * @param {Object} props - Component props
 * @param {number} props.lines - Number of lines
 * @param {string} props.width - Width of each line
 * @param {string} props.className - Additional classes
 */
export const SkeletonText = ({
  lines = 3,
  width = '100%',
  className = '',
}) => {
  return (
    <div className={twMerge('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton 
          key={index} 
          variant="text" 
          width={width}
          className={index === 0 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  );
};

export default Spinner;
