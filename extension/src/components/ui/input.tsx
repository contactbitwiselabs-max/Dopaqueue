import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, ...props }, ref) => {
    if (leftIcon || rightIcon) {
      return (
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-xl border border-[var(--dq-border)] bg-[var(--dq-surface)] px-3 py-2 text-sm text-[var(--dq-text)] ring-offset-background placeholder:text-[var(--dq-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dq-lime-border)] focus-visible:border-[var(--dq-lime)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
              {rightIcon}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl border border-[var(--dq-border)] bg-[var(--dq-surface)] px-3 py-2 text-sm text-[var(--dq-text)] ring-offset-background placeholder:text-[var(--dq-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dq-lime-border)] focus-visible:border-[var(--dq-lime)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
