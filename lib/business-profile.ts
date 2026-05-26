'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useUser } from '@/lib/auth-context';
import { useAccountScope } from '@/lib/account-scope';

export type BusinessProfile = {
  business_name: string;
  legal_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  brand_tagline: string;
  proposal_footer: string;
};

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  business_name: "Zig's Kitchen",
  legal_name: "Zig's Kitchen",
  contact_email: '',
  contact_phone: '',
  website: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  brand_tagline: 'Operations built for food truck operators',
  proposal_footer: "Thank you,\nZig's Kitchen",
};

const STORAGE_KEY = 'gizops.business-profile';

export function readStoredBusinessProfile(): BusinessProfile {
  if (typeof window === 'undefined') return DEFAULT_BUSINESS_PROFILE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_BUSINESS_PROFILE, ...JSON.parse(stored) } : DEFAULT_BUSINESS_PROFILE;
  } catch {
    return DEFAULT_BUSINESS_PROFILE;
  }
}

export function useBusinessProfile() {
  const supabase = createClientComponentClient();
  const { profile, isSuperAdmin } = useUser();
  const { selectedAccountId } = useAccountScope();
  const [business, setBusiness] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [loading, setLoading] = useState(true);
  const [usesLocalStorage, setUsesLocalStorage] = useState(false);

  const persistLocal = useCallback((next: BusinessProfile) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setBusiness(next);
    setUsesLocalStorage(true);
    window.dispatchEvent(new CustomEvent('gizops-business-profile-updated', { detail: next }));
  }, []);

  const fetchBusiness = useCallback(async () => {
    setLoading(true);
    const local = readStoredBusinessProfile();
    setBusiness(local);

    const accountId = isSuperAdmin ? selectedAccountId : profile?.account_id;

    if (!accountId) {
      setUsesLocalStorage(true);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('business_profiles')
      .select('business_name, legal_name, contact_email, contact_phone, website, address, city, state, postal_code, brand_tagline, proposal_footer')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error || !data) {
      setUsesLocalStorage(true);
      setLoading(false);
      return;
    }

    const next = { ...DEFAULT_BUSINESS_PROFILE, ...data };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setBusiness(next);
    setUsesLocalStorage(false);
    setLoading(false);
  }, [isSuperAdmin, profile?.account_id, selectedAccountId, supabase]);

  useEffect(() => { fetchBusiness(); }, [fetchBusiness]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<BusinessProfile>).detail;
      if (detail) setBusiness(detail);
    };
    window.addEventListener('gizops-business-profile-updated', handler);
    return () => window.removeEventListener('gizops-business-profile-updated', handler);
  }, []);

  const saveBusiness = useCallback(async (next: BusinessProfile) => {
    const accountId = isSuperAdmin ? selectedAccountId : profile?.account_id;

    if (!accountId) {
      persistLocal(next);
      return { ok: true, local: true, error: null };
    }

    const { error } = await supabase
      .from('business_profiles')
      .upsert({
        account_id: accountId,
        ...next,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id' });

    if (error) {
      persistLocal(next);
      return { ok: false, local: true, error };
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setBusiness(next);
    setUsesLocalStorage(false);
    window.dispatchEvent(new CustomEvent('gizops-business-profile-updated', { detail: next }));
    return { ok: true, local: false, error: null };
  }, [isSuperAdmin, persistLocal, profile?.account_id, selectedAccountId, supabase]);

  return { business, loading, usesLocalStorage, saveBusiness };
}
