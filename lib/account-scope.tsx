'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useUser } from '@/lib/auth-context';

type ScopedAccount = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

type AccountScopeContextType = {
  accounts: ScopedAccount[];
  selectedAccount: ScopedAccount | null;
  selectedAccountId: string | null;
  loading: boolean;
  setSelectedAccountId: (accountId: string) => void;
  refreshAccounts: () => Promise<void>;
};

const STORAGE_KEY = 'gizops.selected-account-id';

const AccountScopeContext = createContext<AccountScopeContextType>({
  accounts: [],
  selectedAccount: null,
  selectedAccountId: null,
  loading: true,
  setSelectedAccountId: () => {},
  refreshAccounts: async () => {},
});

export function AccountScopeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClientComponentClient();
  const { profile, isSuperAdmin, loading: authLoading } = useUser();
  const [accounts, setAccounts] = useState<ScopedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setSelectedAccountId = useCallback((accountId: string) => {
    setSelectedAccountIdState(accountId);
    window.localStorage.setItem(STORAGE_KEY, accountId);
  }, []);

  const refreshAccounts = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);

    if (!isSuperAdmin) {
      setAccounts([]);
      setSelectedAccountIdState(profile?.account_id ?? null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('accounts')
      .select('id, name, slug, is_active')
      .order('name', { ascending: true });

    if (error) {
      setAccounts([]);
      setSelectedAccountIdState(profile?.account_id ?? null);
      setLoading(false);
      return;
    }

    const nextAccounts = (data ?? []) as ScopedAccount[];
    const storedAccountId = window.localStorage.getItem(STORAGE_KEY);
    const preferredAccountId = storedAccountId || profile?.account_id;
    const selectedExists = preferredAccountId
      ? nextAccounts.some(account => account.id === preferredAccountId)
      : false;
    const fallbackAccount = nextAccounts.find(account => account.is_active) ?? nextAccounts[0] ?? null;
    const nextSelectedId = selectedExists ? preferredAccountId ?? null : fallbackAccount?.id ?? null;

    setAccounts(nextAccounts);
    setSelectedAccountIdState(nextSelectedId);
    if (nextSelectedId) window.localStorage.setItem(STORAGE_KEY, nextSelectedId);
    setLoading(false);
  }, [authLoading, isSuperAdmin, profile?.account_id, supabase]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  const selectedAccount = useMemo(
    () => accounts.find(account => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  return (
    <AccountScopeContext.Provider value={{
      accounts,
      selectedAccount,
      selectedAccountId,
      loading,
      setSelectedAccountId,
      refreshAccounts,
    }}>
      {children}
    </AccountScopeContext.Provider>
  );
}

export const useAccountScope = () => useContext(AccountScopeContext);
