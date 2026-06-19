'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

const THEME_KEY = 'gizops-theme';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    document.documentElement.classList.toggle('dark', nextIsDark);
    window.localStorage.setItem(THEME_KEY, nextIsDark ? 'dark' : 'light');
    setIsDark(nextIsDark);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs font-medium text-mist transition-colors hover:bg-hover hover:text-cream"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      {isDark ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}
