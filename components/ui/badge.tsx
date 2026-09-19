import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
        secondary:
          'bg-slate-800 text-slate-300 border border-slate-700',
        success:
          'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        warning:
          'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        destructive:
          'bg-rose-500/15 text-rose-400 border border-rose-500/30',
        outline:
          'text-slate-300 border border-slate-700',
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
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
