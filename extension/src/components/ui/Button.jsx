import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Button component with consistent styling
 * 
 * @param {Object} props - Component props
 * @param {'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'} props.variant - Button variant
 * @param {'sm' | 'md' | 'lg'} props.size - Button size
 * @param {boolean} props.isLoading - Loading state
 * @param {boolean} props.isDisabled - Disabled state
 * @param {React.ReactNode} props.leftIcon - Left icon
 * @param {React.ReactNode} props.rightIcon - Right icon
 * @param {React.RefObject} props.ref - Ref object
 * @param {string} props.className - Additional classes
 * @param {Object} props.rest - Additional props
 */
export const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  leftIcon = null,
  rightIcon = null,
  className = '',
  onClick,
  type = 'button',
  ...rest
}, ref) => {
  // Base styles
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus-outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';

  // Variant styles
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 active:bg-blue-800',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 active:bg-gray-300 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500 active:bg-blue-100 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 active:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 active:bg-red-800',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  // Icon size styles
  const iconSizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Merge all styles
  const mergedClassName = twMerge(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    className
  );

  // Loading spinner
  const spinnerClassName = twMerge(
    'animate-spin rounded-full border-2 border-current border-t-transparent',
    iconSizeStyles[size]
  );

  return (
    <button
      ref={ref}
      type={type}
      className={mergedClassName}
      onClick={onClick}
      disabled={isDisabled || isLoading}
      {...rest}
    >
      {isLoading ? (
        <svg className={spinnerClassName} role="status" aria-label="Loading">
          <span className="sr-only">Loading...</span>
        </svg>
      ) : (
        <>
          {leftIcon && <span className={iconSizeStyles[size]}>{leftIcon}</span>}
          {children}
          {rightIcon && <span className={iconSizeStyles[size]}>{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
