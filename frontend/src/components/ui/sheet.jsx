import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in', className)}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

const SheetContent = React.forwardRef(({ className, children, side = 'right', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 z-50 flex w-[88%] max-w-sm flex-col border-slate-200 bg-white shadow-elevated outline-none data-[state=open]:animate-fade-in',
        side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-ink-500 transition hover:bg-slate-100 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-semibold text-ink-950', className)} {...props} />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-ink-500', className)} {...props} />
));
SheetDescription.displayName = 'SheetDescription';

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
