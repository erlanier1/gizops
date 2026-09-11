'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Flame, LayoutDashboard, Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { InactivityGuard } from '@/components/inactivity-guard';
import { AccountScopeProvider } from '@/lib/account-scope';
import { useAccountScope } from '@/lib/account-scope';

const AUTH_ROUTES = ['/login', '/auth', '/staff'];

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  const { selectedAccount } = useAccountScope();

  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-sidebar px-3 md:hidden">
      <div className="flex min-w-0 items-center gap-2 text-cream">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ember"><Flame className="h-4 w-4 text-white" /></span>
        <div className="min-w-0">
          <span className="block text-xs font-bold leading-tight">GizOps</span>
          <span className="block truncate text-[11px] leading-tight text-mist">{selectedAccount?.name ?? 'ACIRE Admin Portal'}</span>
        </div>
      </div>
      <button type="button" aria-label="Open navigation" onClick={onOpen} className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-cream hover:bg-hover">
        <span className="text-xs font-semibold">Pages</span><Menu className="h-6 w-6" />
      </button>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (pathname === '/staff') {
    return <>{children}<Link href="/dashboard" className="fixed bottom-4 right-4 z-40 flex min-h-12 items-center gap-2 rounded-xl bg-ember px-5 font-semibold text-white shadow-xl sm:bottom-6 sm:right-6"><LayoutDashboard className="h-5 w-5" />Open Dashboard</Link></>;
  }

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <InactivityGuard>
      <AccountScopeProvider>
        <div className="flex h-dvh w-full max-w-full overflow-hidden">
          <div className="hidden md:block"><Sidebar /></div>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <MobileHeader onOpen={() => setMobileOpen(true)} />
            <main className="min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto bg-coal">
              <div className="w-full min-w-0 max-w-full p-3 sm:p-5 md:p-6 lg:p-8">{children}</div>
            </main>
          </div>
          {mobileOpen && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} /><div className="absolute inset-y-0 left-0 w-72 max-w-[88vw] shadow-2xl"><Sidebar /></div><button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute left-[min(18rem,88vw)] top-2 flex min-h-11 min-w-11 items-center justify-center rounded-r-lg bg-sidebar text-cream"><X className="h-5 w-5" /></button></div>}
        </div>
      </AccountScopeProvider>
    </InactivityGuard>
  );
}
