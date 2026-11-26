import React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink-950 shadow-sm transition-colors placeholder:text-ink-400 hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
