'use client';

import { LockKeyhole, Loader2 } from 'lucide-react';
import { APP_MODULES, ModuleKey, useEnabledModules } from '@/lib/modules';

export function ModuleGate({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
  children: React.ReactNode;
}) {
  const { hasModule, labelFor, loading } = useEnabledModules();
  const module = APP_MODULES.find(item => item.key === moduleKey);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ember" />
      </div>
    );
  }

  if (!hasModule(moduleKey)) {
    return (
      <div className="rounded-xl border border-line bg-smoke p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-coal">
          <LockKeyhole className="h-5 w-5 text-mist/60" />
        </div>
        <h1 className="text-lg font-semibold text-cream">Module Not Enabled</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mist/70">
          {module ? labelFor(module.key) : 'This app'} is not enabled for this company. A super admin can turn it on from Companies.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
