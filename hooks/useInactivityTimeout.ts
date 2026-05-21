'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const;

type InactivityTimeoutOptions = {
  timeoutMinutes?: number;
  warningMinutes?: number;
};

export function useInactivityTimeout({
  timeoutMinutes = 30,
  warningMinutes = 5,
}: InactivityTimeoutOptions = {}) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [showWarning, setShowWarning] = useState(false);

  const timerRef   = useRef<NodeJS.Timeout>();
  const warnRef    = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(false);
  // Track current warning state in a ref so the reset handler
  // doesn't trigger re-renders on every mouse move.
  const isWarning  = useRef(false);

  const handleTimeout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login?reason=timeout');
  }, [supabase, router]);

  const resetTimers = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(warnRef.current);

    if (isWarning.current) {
      isWarning.current = false;
      setShowWarning(false);
    }

    const safeWarningMinutes = Math.max(1, Math.min(warningMinutes, timeoutMinutes - 1));
    const warnAfter = (timeoutMinutes - safeWarningMinutes) * 60 * 1_000;
    const logoutAfter = timeoutMinutes * 60 * 1_000;

    warnRef.current = setTimeout(() => {
      isWarning.current = true;
      setShowWarning(true);
    }, warnAfter);

    timerRef.current = setTimeout(handleTimeout, logoutAfter);
  }, [handleTimeout, timeoutMinutes, warningMinutes]);

  useEffect(() => {
    mountedRef.current = true;

    EVENTS.forEach(e => document.addEventListener(e, resetTimers, { passive: true }));
    resetTimers(); // start timers on mount

    return () => {
      mountedRef.current = false;
      EVENTS.forEach(e => document.removeEventListener(e, resetTimers));
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
    };
  }, [resetTimers]);

  const stayActive = useCallback(() => {
    if (!mountedRef.current) return;
    isWarning.current = false;
    setShowWarning(false);
    resetTimers();
  }, [resetTimers]);

  return { showWarning, stayActive, warningMinutes, timeoutMinutes };
}
