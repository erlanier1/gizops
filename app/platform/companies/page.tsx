'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Building2, CheckCircle2, Loader2, Mail, Plus, Power, Save } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Toast } from '@/components/ui/toast';
import { useUser } from '@/lib/auth-context';
import { APP_MODULES, ModuleKey } from '@/lib/modules';

type AccountModuleRow = {
  module_key: ModuleKey;
  enabled: boolean;
};

type AccountRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  owner_contact_name: string | null;
  owner_contact_email: string | null;
  created_at: string;
  business_profiles?: Array<{
    business_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    brand_tagline: string | null;
  }>;
  account_modules?: AccountModuleRow[];
};

type CompanyForm = {
  name: string;
  slug: string;
  owner_contact_name: string;
  owner_contact_email: string;
  contact_phone: string;
  brand_tagline: string;
};

const initialForm: CompanyForm = {
  name: '',
  slug: '',
  owner_contact_name: '',
  owner_contact_email: '',
  contact_phone: '',
  brand_tagline: '',
};

const inputClass = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
const labelClass = 'block text-xs font-medium text-mist mb-1.5';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function moduleSummary(rows: AccountModuleRow[] | undefined) {
  if (!rows || rows.length === 0) return 'All modules until setup is complete';
  const enabled = rows.filter(row => row.enabled).map(row => APP_MODULES.find(module => module.key === row.module_key)?.label).filter(Boolean);
  return enabled.length ? enabled.join(', ') : 'No paid modules enabled';
}

export default function PlatformCompaniesPage() {
  const supabase = createClientComponentClient();
  const { isSuperAdmin, loading: authLoading } = useUser();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invitingOwner, setInvitingOwner] = useState<Record<string, boolean>>({});
  const [ownerInviteForms, setOwnerInviteForms] = useState<Record<string, { full_name: string; email: string }>>({});
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(['meal_prep', 'pos', 'inventory']);
  const [form, setForm] = useState<CompanyForm>(initialForm);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const selectedSet = useMemo(() => new Set(selectedModules), [selectedModules]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select(`
        id,
        name,
        slug,
        is_active,
        owner_contact_name,
        owner_contact_email,
        created_at,
        business_profiles ( business_name, contact_email, contact_phone, brand_tagline ),
        account_modules ( module_key, enabled )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      setToast({ message: `Company setup table is not ready yet: ${error.message}`, type: 'error' });
      setAccounts([]);
    } else {
      setAccounts((data ?? []) as AccountRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!authLoading && isSuperAdmin) fetchAccounts();
    if (!authLoading && !isSuperAdmin) setLoading(false);
  }, [authLoading, fetchAccounts, isSuperAdmin]);

  const updateForm = (key: keyof CompanyForm, value: string) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
      slug: key === 'name' && !prev.slug ? slugify(value) : prev.slug,
    }));
  };

  const toggleModule = (key: ModuleKey) => {
    setSelectedModules(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  };

  const createCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const cleanSlug = slugify(form.slug || form.name);
    if (!form.name.trim() || !cleanSlug) {
      setToast({ message: 'Company name and slug are required.', type: 'error' });
      setSaving(false);
      return;
    }

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        name: form.name.trim(),
        slug: cleanSlug,
        owner_contact_name: form.owner_contact_name.trim() || null,
        owner_contact_email: form.owner_contact_email.trim() || null,
      })
      .select('id')
      .single();

    if (accountError || !account) {
      setToast({ message: accountError?.message ?? 'Company could not be created.', type: 'error' });
      setSaving(false);
      return;
    }

    const moduleRows = APP_MODULES.map(module => ({
      account_id: account.id,
      module_key: module.key,
      enabled: selectedSet.has(module.key),
    }));

    const [{ error: profileError }, { error: modulesError }] = await Promise.all([
      supabase.from('business_profiles').insert({
        account_id: account.id,
        business_name: form.name.trim(),
        legal_name: form.name.trim(),
        contact_email: form.owner_contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        brand_tagline: form.brand_tagline.trim() || 'Operations built for food service teams',
        proposal_footer: `Thank you,\n${form.name.trim()}`,
      }),
      supabase.from('account_modules').upsert(moduleRows, { onConflict: 'account_id,module_key' }),
    ]);

    if (profileError || modulesError) {
      setToast({ message: profileError?.message ?? modulesError?.message ?? 'Company was created, but setup was incomplete.', type: 'error' });
    } else {
      setToast({ message: `${form.name} was created with ${selectedModules.length} enabled modules.`, type: 'success' });
      setForm(initialForm);
      setSelectedModules(['meal_prep', 'pos', 'inventory']);
      fetchAccounts();
    }

    setSaving(false);
  };

  const toggleAccountActive = async (account: AccountRow) => {
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: !account.is_active, updated_at: new Date().toISOString() })
      .eq('id', account.id);

    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }

    setAccounts(prev => prev.map(item => item.id === account.id ? { ...item, is_active: !account.is_active } : item));
  };

  const toggleExistingModule = async (account: AccountRow, key: ModuleKey) => {
    const current = account.account_modules?.find(row => row.module_key === key)?.enabled ?? false;
    const { error } = await supabase
      .from('account_modules')
      .upsert({
        account_id: account.id,
        module_key: key,
        enabled: !current,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,module_key' });

    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }

    setAccounts(prev => prev.map(item => {
      if (item.id !== account.id) return item;
      const existing = item.account_modules ?? [];
      const found = existing.some(row => row.module_key === key);
      return {
        ...item,
        account_modules: found
          ? existing.map(row => row.module_key === key ? { ...row, enabled: !current } : row)
          : [...existing, { module_key: key, enabled: !current }],
      };
    }));
  };

  const updateOwnerInvite = (accountId: string, key: 'full_name' | 'email', value: string) => {
    setOwnerInviteForms(prev => ({
      ...prev,
      [accountId]: {
        full_name: prev[accountId]?.full_name ?? '',
        email: prev[accountId]?.email ?? '',
        [key]: value,
      },
    }));
  };

  const inviteOwner = async (account: AccountRow) => {
    const invite = ownerInviteForms[account.id] ?? {
      full_name: account.owner_contact_name ?? '',
      email: account.owner_contact_email ?? '',
    };

    if (!invite.full_name.trim() || !invite.email.trim()) {
      setToast({ message: 'Owner name and email are required.', type: 'error' });
      return;
    }

    setInvitingOwner(prev => ({ ...prev, [account.id]: true }));
    try {
      const res = await fetch(`/api/platform/companies/${account.id}/owner-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: invite.full_name,
          email: invite.email,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setToast({ message: body.error ?? 'Owner invite failed.', type: 'error' });
        return;
      }

      setAccounts(prev => prev.map(item => item.id === account.id
        ? { ...item, owner_contact_name: invite.full_name, owner_contact_email: invite.email }
        : item
      ));
      setOwnerInviteForms(prev => ({ ...prev, [account.id]: { full_name: '', email: '' } }));
      setToast({ message: `Owner invite sent to ${invite.email}.`, type: 'success' });
    } catch {
      setToast({ message: 'Owner invite failed.', type: 'error' });
    } finally {
      setInvitingOwner(prev => ({ ...prev, [account.id]: false }));
    }
  };

  if (!authLoading && !isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Companies" description="Platform company onboarding and module access." />
        <div className="rounded-xl border border-line bg-smoke p-8 text-sm text-mist">
          Only super admins can manage company onboarding.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Create companies, store onboarding details, and control which app modules they can access."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={createCompany} className="rounded-xl border border-line bg-smoke p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-ember/30 bg-ember/15">
              <Plus className="h-5 w-5 text-ember" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-cream">New Company</h2>
              <p className="text-xs text-mist/60">Start the account and enable paid modules.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="company_name">Company name *</label>
              <input id="company_name" className={inputClass} value={form.name} onChange={event => updateForm('name', event.target.value)} placeholder="Acme Catering" />
            </div>
            <div>
              <label className={labelClass} htmlFor="company_slug">Platform slug *</label>
              <input id="company_slug" className={inputClass} value={form.slug} onChange={event => updateForm('slug', slugify(event.target.value))} placeholder="acme-catering" />
            </div>
            <div>
              <label className={labelClass} htmlFor="owner_contact_name">Owner contact name</label>
              <input id="owner_contact_name" className={inputClass} value={form.owner_contact_name} onChange={event => updateForm('owner_contact_name', event.target.value)} placeholder="Jordan Smith" />
            </div>
            <div>
              <label className={labelClass} htmlFor="owner_contact_email">Owner contact email</label>
              <input id="owner_contact_email" type="email" className={inputClass} value={form.owner_contact_email} onChange={event => updateForm('owner_contact_email', event.target.value)} placeholder="owner@example.com" />
            </div>
            <div>
              <label className={labelClass} htmlFor="contact_phone">Business phone</label>
              <input id="contact_phone" className={inputClass} value={form.contact_phone} onChange={event => updateForm('contact_phone', event.target.value)} placeholder="(555) 555-0199" />
            </div>
            <div>
              <label className={labelClass} htmlFor="brand_tagline">Tagline</label>
              <input id="brand_tagline" className={inputClass} value={form.brand_tagline} onChange={event => updateForm('brand_tagline', event.target.value)} placeholder="Operations built for food service teams" />
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-mist/50">Enabled modules</p>
            <div className="grid grid-cols-1 gap-2">
              {APP_MODULES.map(module => (
                <label key={module.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-coal p-3 hover:border-ember/40">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(module.key)}
                    onChange={() => toggleModule(module.key)}
                    className="mt-1 h-4 w-4 accent-ember"
                  />
                  <span>
                    <span className="block text-sm font-medium text-cream">{module.label}</span>
                    <span className="block text-xs leading-5 text-mist/60">{module.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ember-dark disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Create Company
          </button>
        </form>

        <section className="rounded-xl border border-line bg-smoke">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-cream">Company Access</h2>
              <p className="mt-1 text-xs text-mist/60">Turn modules on or off as customers subscribe, cancel, or upgrade.</p>
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-ember" />}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-ember" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-sm text-mist/70">
              No companies yet. Create the first company to begin onboarding.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {accounts.map(account => {
                const profile = account.business_profiles?.[0];
                const ownerInvite = ownerInviteForms[account.id] ?? {
                  full_name: account.owner_contact_name ?? '',
                  email: account.owner_contact_email ?? '',
                };
                return (
                  <div key={account.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-ember" />
                          <h3 className="text-sm font-semibold text-cream">{account.name}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${account.is_active ? 'border-green-800 bg-green-900/30 text-green-400' : 'border-red-800 bg-red-900/30 text-red-400'}`}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-mist/60">/{account.slug}</p>
                        <p className="mt-2 max-w-2xl text-xs leading-5 text-mist/70">
                          {profile?.brand_tagline || 'No tagline saved yet.'}
                        </p>
                        <p className="mt-2 text-xs text-mist/50">
                          Owner contact: {account.owner_contact_name || 'Not set'} {account.owner_contact_email ? `- ${account.owner_contact_email}` : ''}
                        </p>
                        <p className="mt-2 text-xs text-mist/50">
                          Enabled: {moduleSummary(account.account_modules)}
                        </p>
                        <div className="mt-3 rounded-lg border border-line bg-coal px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-mist/50">Website contact intake</p>
                          <p className="mt-1 break-all font-mono text-[11px] text-mist/70">POST /api/contact-leads with accountSlug: {account.slug}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleAccountActive(account)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist transition-colors hover:bg-hover hover:text-cream"
                      >
                        <Power className="h-3.5 w-3.5" />
                        {account.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                      {APP_MODULES.map(module => {
                        const enabled = account.account_modules?.find(row => row.module_key === module.key)?.enabled ?? false;
                        return (
                          <button
                            key={module.key}
                            onClick={() => toggleExistingModule(account, module.key)}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                              enabled
                                ? 'border-ember/50 bg-ember/10 text-cream'
                                : 'border-line bg-coal text-mist/60 hover:border-ember/40'
                            }`}
                          >
                            <span>{module.label}</span>
                            {enabled && <CheckCircle2 className="h-3.5 w-3.5 text-ember" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 rounded-lg border border-line bg-coal p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Mail className="h-4 w-4 text-ember" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-mist/60">Company Owner Invite</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
                        <div>
                          <label className={labelClass} htmlFor={`owner-name-${account.id}`}>Owner name</label>
                          <input
                            id={`owner-name-${account.id}`}
                            className={inputClass}
                            value={ownerInvite.full_name}
                            onChange={event => updateOwnerInvite(account.id, 'full_name', event.target.value)}
                            placeholder="Owner full name"
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`owner-email-${account.id}`}>Owner email</label>
                          <input
                            id={`owner-email-${account.id}`}
                            type="email"
                            className={inputClass}
                            value={ownerInvite.email}
                            onChange={event => updateOwnerInvite(account.id, 'email', event.target.value)}
                            placeholder="owner@example.com"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => inviteOwner(account)}
                            disabled={invitingOwner[account.id]}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ember-dark disabled:opacity-60 lg:w-auto"
                          >
                            {invitingOwner[account.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            Invite Owner
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-mist/60">
                        The invite creates an owner profile tied to this company account. That owner can then invite managers and staff for their own business.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
