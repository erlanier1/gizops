'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const;

export function useInactivityTimeout(minutes = 15) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [showWarning, setShowWarning] = useState(false);

  const timerRef   = useRef<NodeJS.Timeout>();
  const warnRef    = useRef<NodeJS.Timeout>();
  // Track current warning state in a ref so the reset handler
  // doesn't trigger re-renders on every mouse move.
  const isWarning  = useRef(false);

  const handleTimeout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login?reason=timeout');
  }, [supabase, router]);

  useEffect(() => {
    const warnAfter  = (minutes - 3) * 60 * 1_000;  // 12 min
    const logoutAfter = minutes * 60 * 1_000;         // 15 min

    const reset = () => {
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);

      // Only update React state when the value actually changes
      if (isWarning.current) {
        isWarning.current = false;
        setShowWarning(false);
      }

      warnRef.current = setTimeout(() => {
        isWarning.current = true;
        setShowWarning(true);
      }, warnAfter);

      timerRef.current = setTimeout(handleTimeout, logoutAfter);
    };

    EVENTS.forEach(e => document.addEventListener(e, reset, { passive: true }));
    reset(); // start timers on mount

    return () => {
      EVENTS.forEach(e => document.removeEventListener(e, reset));
      clearTimeout(timerRef.current);
      clearTimeout(warnRef.current);
    };
  }, [minutes, handleTimeout]);

  const dismissWarning = useCallback(() => {
    isWarning.current = false;
    setShowWarning(false);
  }, []);

  return { showWarning, dismissWarning };
}
