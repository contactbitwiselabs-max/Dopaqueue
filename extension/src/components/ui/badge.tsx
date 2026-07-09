import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-zinc-700 bg-zinc-800 text-zinc-200',
        primary: 'border-lime-500/30 bg-lime-500/15 text-lime-300',
        secondary: 'border-zinc-700 bg-zinc-900 text-zinc-400',
        destructive: 'border-red-500/30 bg-red-500/15 text-red-400',
        outline: 'border-zinc-600 text-zinc-300 bg-transparent',
        video: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
        short: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
        reel: 'border-pink-500/30 bg-pink-500/10 text-pink-400',
        post: 'border-green-500/30 bg-green-500/10 text-green-400',
        success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
        warning: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
