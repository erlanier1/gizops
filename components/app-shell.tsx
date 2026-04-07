'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { InactivityGuard } from '@/components/inactivity-guard';

const AUTH_ROUTES = ['/login', '/auth'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <InactivityGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-coal">
          <div className="p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </InactivityGuard>
  );
}
