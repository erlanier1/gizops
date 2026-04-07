'use client';

import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { X } from 'lucide-react';

export function InactivityGuard({ children }: { children: React.ReactNode }) {
  const { showWarning, dismissWarning } = useInactivityTimeout(15);

  return (
    <>
      {showWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-amber-900/95 border-b border-amber-700/60 px-4 py-3 backdrop-blur-sm shadow-lg">
          <p className="text-sm text-amber-100">
            You&apos;ll be logged out in <strong>3 minutes</strong> due to inactivity.{' '}
            <button
              onClick={dismissWarning}
              className="underline underline-offset-2 hover:text-white transition-colors"
            >
              Click here to stay logged in.
            </button>
          </p>
          <button
            onClick={dismissWarning}
            className="shrink-0 text-amber-300 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {children}
    </>
  );
}
