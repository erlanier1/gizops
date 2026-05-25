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
  | 'contacts'
  | 'documents'
  | 'reports';

export type Industry = 'food_service' | 'beauty' | 'general_service';

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
  { key: 'contacts', label: 'Contacts', description: 'Website leads, client contact info, and follow-up status.' },
  { key: 'documents', label: 'Documents', description: 'Document storage and operational files.' },
  { key: 'reports', label: 'Reports', description: 'Standard reports and export tools.' },
];

const ALL_MODULE_KEYS = APP_MODULES.map(module => module.key);
const DEFAULT_INDUSTRY: Industry = 'food_service';

export const INDUSTRY_LABELS: Record<Industry, Partial<Record<ModuleKey, string>>> = {
  food_service: {
    meal_prep: 'Meal Prep',
    bookings: 'Bookings',
    permits: 'Compliance',
    proposals: 'Proposals',
    pos: 'POS',
    inventory: 'Inventory',
    contacts: 'Leads',
  },
  beauty: {
    meal_prep: 'Client Plans',
    bookings: 'Appointments',
    permits: 'Licenses',
    proposals: 'Service Quotes',
    pos: 'Checkout',
    inventory: 'Products & Supplies',
    contacts: 'Clients & Leads',
    documents: 'Client Files',
  },
  general_service: {
    meal_prep: 'Service Plans',
    bookings: 'Appointments',
    permits: 'Compliance',
    proposals: 'Quotes',
    pos: 'Payments',
    inventory: 'Inventory',
    contacts: 'Contacts',
  },
};

export function isIndustry(value: unknown): value is Industry {
  return value === 'food_service' || value === 'beauty' || value === 'general_service';
}

export function labelsForIndustry(industry: Industry, overrides?: Partial<Record<ModuleKey, string>>) {
  const preset = INDUSTRY_LABELS[industry] ?? INDUSTRY_LABELS[DEFAULT_INDUSTRY];
  return Object.fromEntries(
    APP_MODULES.map(module => [
      module.key,
      overrides?.[module.key]?.trim() || preset[module.key] || module.label,
    ])
  ) as Record<ModuleKey, string>;
}

export function useEnabledModules() {
  const supabase = createClientComponentClient();
  const { profile, isSuperAdmin } = useUser();
  const [enabledModules, setEnabledModules] = useState<ModuleKey[]>(ALL_MODULE_KEYS);
  const [industry, setIndustry] = useState<Industry>(DEFAULT_INDUSTRY);
  const [labelOverrides, setLabelOverrides] = useState<Partial<Record<ModuleKey, string>>>({});
  const [loading, setLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    setLoading(true);

    if (isSuperAdmin || !profile?.account_id) {
      setEnabledModules(ALL_MODULE_KEYS);
      setLoading(false);
      return;
    }

    const accountResult = await supabase
      .from('accounts')
      .select('industry, label_overrides')
      .eq('id', profile.account_id)
      .single();

    if (!accountResult.error && accountResult.data) {
      setIndustry(isIndustry(accountResult.data.industry) ? accountResult.data.industry : DEFAULT_INDUSTRY);
      const overrides = accountResult.data.label_overrides;
      setLabelOverrides(overrides && typeof overrides === 'object' && !Array.isArray(overrides)
        ? overrides as Partial<Record<ModuleKey, string>>
        : {}
      );
    } else {
      setIndustry(DEFAULT_INDUSTRY);
      setLabelOverrides({});
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
  const labels = useMemo(() => labelsForIndustry(industry, labelOverrides), [industry, labelOverrides]);

  return {
    enabledModules,
    industry,
    labels,
    loading,
    hasModule: (key: ModuleKey) => enabledSet.has(key),
    labelFor: (key: ModuleKey) => labels[key],
    refreshModules: fetchModules,
  };
}
