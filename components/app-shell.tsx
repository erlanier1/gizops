'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Flame, Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { InactivityGuard } from '@/components/inactivity-guard';
import { AccountScopeProvider } from '@/lib/account-scope';

const AUTH_ROUTES = ['/login', '/auth', '/staff'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <InactivityGuard>
      <AccountScopeProvider>
        <div className="flex h-dvh overflow-hidden">
          <div className="hidden md:block"><Sidebar /></div>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-sidebar px-4 md:hidden">
              <div className="flex items-center gap-2 text-cream"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember"><Flame className="h-4 w-4 text-white" /></span><span className="font-bold">GizOps</span></div>
              <button type="button" aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-cream hover:bg-hover"><Menu className="h-6 w-6" /></button>
            </header>
            <main className="min-w-0 flex-1 overflow-y-auto bg-coal">
              <div className="p-4 sm:p-5 md:p-6 lg:p-8">{children}</div>
            </main>
          </div>
          {mobileOpen && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} /><div className="absolute inset-y-0 left-0 w-72 max-w-[88vw] shadow-2xl"><Sidebar /></div><button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute left-[min(18rem,88vw)] top-2 flex min-h-11 min-w-11 items-center justify-center rounded-r-lg bg-sidebar text-cream"><X className="h-5 w-5" /></button></div>}
        </div>
      </AccountScopeProvider>
    </InactivityGuard>
  );
}
