import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Card component with consistent styling
 * 
 * @param {Object} props - Component props
 * @param {'sm' | 'md' | 'lg'} props.size - Card size
 * @param {boolean} props.isHoverable - Whether card is hoverable
 * @param {boolean} props.isClickable - Whether card is clickable
 * @param {React.ReactNode} props.header - Card header content
 * @param {React.ReactNode} props.footer - Card footer content
 * @param {string} props.className - Additional classes
 * @param {React.RefObject} props.ref - Ref object
 * @param {Object} props.rest - Additional props
 */
export const Card = forwardRef(({
  children,
  size = 'md',
  isHoverable = false,
  isClickable = false,
  header = null,
  footer = null,
  className = '',
  onClick,
  ...rest
}, ref) => {
  // Base styles
  const baseStyles = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700';

  // Size styles
  const sizeStyles = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  // Interactive styles
  const interactiveStyles = clsx({
    'cursor-pointer transition-all duration-200': isClickable || isHoverable,
    'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600': isHoverable,
    'active:scale-[0.98]': isClickable,
  });

  // Merge all styles
  const mergedClassName = twMerge(
    baseStyles,
    sizeStyles[size],
    interactiveStyles,
    className
  );

  return (
    <div
      ref={ref}
      className={mergedClassName}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      {...rest}
    >
      {header && <div className="mb-4">{header}</div>}
      {children}
      {footer && <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">{footer}</div>}
    </div>
  );
});

Card.displayName = 'Card';

/**
 * Card Header component
 */
export const CardHeader = forwardRef(({ children, className = '', ...rest }, ref) => {
  return (
    <div
      ref={ref}
      className={twMerge('flex items-center justify-between', className)}
      {...rest}
    >
      {children}
    </div>
  );
});

CardHeader.displayName = 'CardHeader';

/**
 * Card Title component
 */
export const CardTitle = forwardRef(({ children, className = '', ...rest }, ref) => {
  return (
    <h3
      ref={ref}
      className={twMerge('text-lg font-semibold text-gray-900 dark:text-gray-100', className)}
      {...rest}
    >
      {children}
    </h3>
  );
});

CardTitle.displayName = 'CardTitle';

/**
 * Card Description component
 */
export const CardDescription = forwardRef(({ children, className = '', ...rest }, ref) => {
  return (
    <p
      ref={ref}
      className={twMerge('text-sm text-gray-500 dark:text-gray-400 mt-1', className)}
      {...rest}
    >
      {children}
    </p>
  );
});

CardDescription.displayName = 'CardDescription';

/**
 * Card Content component
 */
export const CardContent = forwardRef(({ children, className = '', ...rest }, ref) => {
  return (
    <div
      ref={ref}
      className={twMerge('text-gray-700 dark:text-gray-300', className)}
      {...rest}
    >
      {children}
    </div>
  );
});

CardContent.displayName = 'CardContent';

/**
 * Card Footer component
 */
export const CardFooter = forwardRef(({ children, className = '', ...rest }, ref) => {
  return (
    <div
      ref={ref}
      className={twMerge('flex items-center justify-between', className)}
      {...rest}
    >
      {children}
    </div>
  );
});

CardFooter.displayName = 'CardFooter';

export default Card;
