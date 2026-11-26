import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700',
        secondary: 'bg-primary-50 text-primary-700',
        success: 'bg-emerald-50 text-emerald-700',
        warning: 'bg-amber-50 text-amber-800',
        danger: 'bg-red-50 text-red-700',
        info: 'bg-blue-50 text-blue-700',
        outline: 'border border-slate-200 bg-white text-ink-600',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
