'use client';

import { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, type = 'success', onDismiss, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl',
        type === 'success' ? 'bg-smoke border-green-800/60' : 'bg-smoke border-red-800/60'
      )}
    >
      {type === 'success'
        ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
        : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
      <span className="text-sm text-cream">{message}</span>
      <button onClick={onDismiss} className="ml-1 text-mist hover:text-cream transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
