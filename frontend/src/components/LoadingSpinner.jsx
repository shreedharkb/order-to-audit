import React from 'react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="surface flex min-h-48 flex-col items-center justify-center p-10 text-center" role="status" aria-live="polite">
      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50">
        <span className="absolute h-7 w-7 animate-spin rounded-full border-[3px] border-primary-200 border-t-primary-600" />
      </span>
      <p className="mt-4 text-sm font-semibold text-ink-700">{message}</p>
      <p className="mt-1 text-xs text-ink-400">Please wait a moment</p>
    </div>
  );
}
