import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Badge component for displaying status, tags, etc.
 * 
 * @param {Object} props - Component props
 * @param {'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'} props.variant - Badge variant
 * @param {'sm' | 'md' | 'lg'} props.size - Badge size
 * @param {boolean} props.isDotVisible - Whether to show a dot indicator
 * @param {string} props.className - Additional classes
 * @param {React.RefObject} props.ref - Ref object
 * @param {Object} props.rest - Additional props
 */
export const Badge = forwardRef(({
  children,
  variant = 'default',
  size = 'md',
  isDotVisible = false,
  className = '',
  ...rest
}, ref) => {
  // Base styles
  const baseStyles = 'inline-flex items-center font-medium rounded-full';

  // Variant styles
  const variantStyles = {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    secondary: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    info: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  // Dot styles
  const dotStyles = {
    default: 'bg-gray-500',
    primary: 'bg-blue-500',
    secondary: 'bg-purple-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-cyan-500',
  };

  // Merge all styles
  const mergedClassName = twMerge(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    className
  );

  return (
    <span
      ref={ref}
      className={mergedClassName}
      {...rest}
    >
      {isDotVisible && (
        <span 
          className={clsx(
            'w-1.5 h-1.5 rounded-full mr-1.5',
            dotStyles[variant]
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';

export default Badge;
