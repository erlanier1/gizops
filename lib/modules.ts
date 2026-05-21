'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useUser } from '@/lib/auth-context';

export type ModuleKey =
  | 'meal_prep'
  | 'bookings'
  | 'permits'
  | 'proposals'
  | 'pos'
  | 'inventory'
  | 'documents'
  | 'reports';

export type AppModule = {
  key: ModuleKey;
  label: string;
  description: string;
};

export const APP_MODULES: AppModule[] = [
  { key: 'meal_prep', label: 'Meal Prep', description: 'Meal prep clients, schedules, and payment links.' },
  { key: 'bookings', label: 'Bookings', description: 'Food truck and catering event booking pipeline.' },
  { key: 'permits', label: 'Compliance', description: 'Permits, licenses, inspections, insurance, and renewal tracking.' },
  { key: 'proposals', label: 'Proposals', description: 'Catering proposals, contract drafts, and client emails.' },
  { key: 'pos', label: 'POS', description: 'Food truck order taking with Stripe Checkout.' },
  { key: 'inventory', label: 'Inventory', description: 'Supply tracking and POS inventory deduction.' },
  { key: 'documents', label: 'Documents', description: 'Document storage and operational files.' },
  { key: 'reports', label: 'Reports', description: 'Standard reports and export tools.' },
];

const ALL_MODULE_KEYS = APP_MODULES.map(module => module.key);

export function useEnabledModules() {
  const supabase = createClientComponentClient();
  const { profile, isSuperAdmin } = useUser();
  const [enabledModules, setEnabledModules] = useState<ModuleKey[]>(ALL_MODULE_KEYS);
  const [loading, setLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    setLoading(true);

    if (isSuperAdmin || !profile?.account_id) {
      setEnabledModules(ALL_MODULE_KEYS);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('account_modules')
      .select('module_key, enabled')
      .eq('account_id', profile.account_id);

    if (error || !data || data.length === 0) {
      setEnabledModules(ALL_MODULE_KEYS);
      setLoading(false);
      return;
    }

    setEnabledModules(
      data
        .filter(row => row.enabled)
        .map(row => row.module_key as ModuleKey)
        .filter((key): key is ModuleKey => ALL_MODULE_KEYS.includes(key))
    );
    setLoading(false);
  }, [isSuperAdmin, profile?.account_id, supabase]);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  const enabledSet = useMemo(() => new Set(enabledModules), [enabledModules]);

  return {
    enabledModules,
    loading,
    hasModule: (key: ModuleKey) => enabledSet.has(key),
    refreshModules: fetchModules,
  };
}
