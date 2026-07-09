import React, { forwardRef, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Input component with consistent styling
 * 
 * @param {Object} props - Component props
 * @param {string} props.variant - Input variant ('outline', 'filled', 'ghost')
 * @param {string} props.size - Input size ('sm', 'md', 'lg')
 * @param {string} props.label - Input label
 * @param {string} props.helperText - Helper text below input
 * @param {string} props.error - Error message
 * @param {boolean} props.isDisabled - Disabled state
 * @param {boolean} props.isReadOnly - Read-only state
 * @param {React.ReactNode} props.leftIcon - Left icon/addon
 * @param {React.ReactNode} props.rightIcon - Right icon/addon
 * @param {string} props.className - Additional classes
 * @param {React.RefObject} props.ref - Ref object
 * @param {Object} props.rest - Additional props
 */
export const Input = forwardRef(({
  variant = 'outline',
  size = 'md',
  label,
  helperText,
  error,
  isDisabled = false,
  isReadOnly = false,
  leftIcon = null,
  rightIcon = null,
  className = '',
  type = 'text',
  id,
  ...rest
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  // Base styles
  const baseStyles = 'w-full transition-colors duration-200';

  // Variant styles
  const variantStyles = {
    outline: 'border border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-800 dark:border-gray-600 dark:focus:border-blue-400',
    filled: 'border-0 bg-gray-100 focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-700',
    ghost: 'border-0 bg-transparent focus:ring-0',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  };

  // Icon container styles
  const iconContainerStyles = {
    sm: 'pl-3',
    md: 'pl-4',
    lg: 'pl-5',
  };

  // Icon styles
  const iconStyles = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Label styles
  const labelStyles = 'block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300';

  // Helper text styles
  const helperTextStyles = 'mt-1.5 text-xs text-gray-500 dark:text-gray-400';

  // Error text styles
  const errorTextStyles = 'mt-1.5 text-xs text-red-500 dark:text-red-400';

  // Input wrapper styles (for icons)
  const inputWrapperStyles = 'relative flex items-center';

  // Merge all styles
  const mergedInputClassName = twMerge(
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    isDisabled ? 'opacity-50 cursor-not-allowed' : '',
    isReadOnly ? 'cursor-default' : '',
    error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-400 dark:focus:border-red-400' : '',
    className
  );

  // Focus ring styles
  const focusRingStyles = isFocused && !isDisabled && !isReadOnly ? 'ring-2 ring-blue-500/20' : '';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={labelStyles}>
          {label}
        </label>
      )}
      
      <div className={inputWrapperStyles}>
        {leftIcon && (
          <div className={clsx('absolute z-10 flex items-center justify-center text-gray-400', iconContainerStyles[size])}>
            <span className={iconStyles[size]}>{leftIcon}</span>
          </div>
        )}
        
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={twMerge(
            mergedInputClassName,
            leftIcon ? clsx('pl-10', sizeStyles[size]) : '',
            rightIcon ? 'pr-10' : '',
            focusRingStyles
          )}
          disabled={isDisabled}
          readOnly={isReadOnly}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...rest}
        />
        
        {rightIcon && (
          <div className={clsx('absolute right-0 flex items-center justify-center pr-3 text-gray-400', iconContainerStyles[size])}>
            <span className={iconStyles[size]}>{rightIcon}</span>
          </div>
        )}
      </div>
      
      {error && (
        <p id={`${inputId}-error`} className={errorTextStyles} role="alert">
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p id={`${inputId}-helper`} className={helperTextStyles}>
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
