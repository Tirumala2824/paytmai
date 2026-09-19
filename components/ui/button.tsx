import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20',
        secondary:
          'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700/60',
        destructive:
          'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-600/20',
        outline:
          'border border-slate-700 bg-transparent hover:bg-slate-800/60 text-slate-200',
        ghost: 'hover:bg-slate-800/60 text-slate-300 hover:text-white',
        link: 'text-indigo-400 underline-offset-4 hover:underline p-0 h-auto',
        success:
          'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-xl px-6 text-base font-semibold',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
