'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Flame, LayoutDashboard, Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { InactivityGuard } from '@/components/inactivity-guard';
import { AccountScopeProvider } from '@/lib/account-scope';
import { useAccountScope } from '@/lib/account-scope';
import { useUser } from '@/lib/auth-context';

const AUTH_ROUTES = ['/login', '/auth', '/staff'];

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  const { accounts, selectedAccount, selectedAccountId, setSelectedAccountId } = useAccountScope();
  const { isSuperAdmin } = useUser();

  return (
    <header className="shrink-0 border-b border-line bg-sidebar px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-cream">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ember"><Flame className="h-4 w-4 text-white" /></span>
          <div className="min-w-0">
            <span className="block text-xs font-bold leading-tight">GizOps</span>
            <span className="block truncate text-[11px] leading-tight text-mist">{selectedAccount?.name ?? 'ACIRE Admin Portal'}</span>
          </div>
        </div>
        <button type="button" aria-label="Open full dashboard navigation" onClick={onOpen} className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-cream hover:bg-hover">
          <span className="text-xs font-semibold">Menu</span><Menu className="h-5 w-5" />
        </button>
      </div>
      {isSuperAdmin && accounts.length > 0 && (
        <label className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-mist">Workspace</span>
          <select
            aria-label="Company workspace"
            value={selectedAccountId ?? ''}
            onChange={event => setSelectedAccountId(event.target.value || null)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-coal px-2 py-2 text-sm text-cream focus:border-ember focus:outline-none"
          >
            <option value="">Admin Portal</option>
            {accounts.map(account => <option key={account.id} value={account.id}>{account.name}{account.is_active ? '' : ' (inactive)'}</option>)}
          </select>
        </label>
      )}
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
          {mobileOpen && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} /><div className="absolute inset-y-0 left-0 w-[min(20rem,calc(100vw-2.75rem))] overflow-hidden shadow-2xl" onClick={event => { if ((event.target as HTMLElement).closest('a')) setMobileOpen(false); }}><Sidebar /></div><button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute right-1 top-[max(0.5rem,env(safe-area-inset-top))] flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-sidebar text-cream shadow-lg"><X className="h-5 w-5" /></button></div>}
        </div>
      </AccountScopeProvider>
    </InactivityGuard>
  );
}
