import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center p-10 text-center" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
      <p className="mt-3 text-sm font-medium text-ink-700">{message}</p>
    </div>
  );
}
