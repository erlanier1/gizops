'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Save, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Toast } from '@/components/ui/toast';
import { OwnerOnly } from '@/components/RoleGuard';
import { BusinessProfile, useBusinessProfile } from '@/lib/business-profile';
import { useUser } from '@/lib/auth-context';
import { useAccountScope } from '@/lib/account-scope';

const inputClass = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
const labelClass = 'block text-xs font-medium text-mist mb-1.5';

const roleMatrix = [
  {
    area: 'Platform administration',
    super_admin: 'All businesses, system setup',
    owner: 'Own business only',
    manager: 'No access',
    staff: 'No access',
  },
  {
    area: 'Team and role management',
    super_admin: 'Create owners and all roles',
    owner: 'Invite managers/staff',
    manager: 'No role changes',
    staff: 'No access',
  },
  {
    area: 'Payments and reports',
    super_admin: 'View all',
    owner: 'View financials',
    manager: 'Operational payment links',
    staff: 'Hidden financials',
  },
  {
    area: 'POS and order taking',
    super_admin: 'Configure and audit',
    owner: 'Configure and audit',
    manager: 'Run POS and manage menu',
    staff: 'Run assigned POS workflows',
  },
  {
    area: 'Inventory',
    super_admin: 'Configure and audit',
    owner: 'Full control',
    manager: 'Add/update counts',
    staff: 'View/use assigned workflows',
  },
  {
    area: 'Contracts/proposals',
    super_admin: 'Configure and audit',
    owner: 'Create/edit/delete',
    manager: 'Create/edit/send',
    staff: 'No access',
  },
];

export default function SettingsPage() {
  const { business, usesLocalStorage, saveBusiness } = useBusinessProfile();
  const { isSuperAdmin } = useUser();
  const { selectedAccount, selectedAccountId } = useAccountScope();
  const [form, setForm] = useState<BusinessProfile>(business);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const needsCompanySelection = isSuperAdmin && !selectedAccountId;

  useEffect(() => { setForm(business); }, [business]);

  const set = (key: keyof BusinessProfile, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (needsCompanySelection) {
      setToast({ message: 'Choose a company workspace before saving shared business settings.', type: 'error' });
      return;
    }

    setSaving(true);
    const result = await saveBusiness(form);
    setSaving(false);

    if (!result.ok) {
      setToast({ message: 'Saved locally. Run the business profile SQL setup for shared business settings.', type: 'error' });
      return;
    }

    setToast({ message: result.local ? 'Business profile saved locally.' : 'Business profile saved.', type: 'success' });
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Business profile, branding, and segregation-of-duties configuration."
      />

      {usesLocalStorage && (
        <div className="mb-5 rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-xs leading-5 text-amber-200">
          {needsCompanySelection ? (
            <>
              Choose a company workspace from the sidebar before editing shared business settings.
              <a href="/platform/companies" className="ml-1 font-semibold text-amber-100 underline underline-offset-2">
                Open Companies
              </a>
            </>
          ) : (
            'Business settings are saved locally because this user profile is not connected to a company account or the business profile database setup is not available.'
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <OwnerOnly>
          <section className="rounded-xl bg-smoke border border-line p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ember/15 border border-ember/30">
                <Building2 className="h-5 w-5 text-ember" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-cream">Business Profile</h2>
                <p className="text-xs text-mist/60">Use this to rebrand the app for another business.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="business_name" className={labelClass}>Business name</label>
                <input id="business_name" className={inputClass} value={form.business_name} onChange={e => set('business_name', e.target.value)} />
              </div>
              <div>
                <label htmlFor="legal_name" className={labelClass}>Legal name</label>
                <input id="legal_name" className={inputClass} value={form.legal_name} onChange={e => set('legal_name', e.target.value)} />
              </div>
              <div>
                <label htmlFor="contact_email" className={labelClass}>Contact email</label>
                <input id="contact_email" type="email" className={inputClass} value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
              </div>
              <div>
                <label htmlFor="contact_phone" className={labelClass}>Contact phone</label>
                <input id="contact_phone" className={inputClass} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="website" className={labelClass}>Website</label>
                <input id="website" className={inputClass} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.com" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="address" className={labelClass}>Address</label>
                <input id="address" className={inputClass} value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div>
                <label htmlFor="city" className={labelClass}>City</label>
                <input id="city" className={inputClass} value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="state" className={labelClass}>State</label>
                  <input id="state" className={inputClass} value={form.state} onChange={e => set('state', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="postal_code" className={labelClass}>ZIP</label>
                  <input id="postal_code" className={inputClass} value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="brand_tagline" className={labelClass}>Brand tagline</label>
                <input id="brand_tagline" className={inputClass} value={form.brand_tagline} onChange={e => set('brand_tagline', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="proposal_footer" className={labelClass}>Proposal email footer</label>
                <textarea id="proposal_footer" className={`${inputClass} min-h-[90px] resize-none`} value={form.proposal_footer} onChange={e => set('proposal_footer', e.target.value)} />
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-line pt-5">
              <button onClick={handleSave} disabled={saving || needsCompanySelection} className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark disabled:opacity-60 transition-colors">
                {saving ? <Save className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
                {selectedAccount ? `Save ${selectedAccount.name} Profile` : 'Save Business Profile'}
              </button>
            </div>
          </section>
        </OwnerOnly>

        <aside className="space-y-4">
          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-ember" />
              <h2 className="text-sm font-semibold text-cream">Segregation of Duties</h2>
            </div>
            <div className="space-y-3 text-xs leading-5 text-mist/70">
              <p>Use roles to separate payment access, inventory changes, proposal authority, and team administration.</p>
              <p>ACIRE Owner operates the platform. Company Owner controls business finances and users. Manager runs daily operations. Staff should only access assigned workflows.</p>
            </div>
          </div>

          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-ember" />
              <h2 className="text-sm font-semibold text-cream">Business Preview</h2>
            </div>
            <div className="rounded-lg border border-line bg-coal p-4">
              <p className="text-lg font-bold text-cream">{form.business_name || 'Business name'}</p>
              <p className="mt-1 text-xs text-mist">{form.brand_tagline || 'Brand tagline'}</p>
              <p className="mt-3 text-xs leading-5 text-mist/70">
                {form.contact_email || 'contact@example.com'}{form.contact_phone ? ` · ${form.contact_phone}` : ''}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-6 rounded-xl bg-smoke border border-line overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-cream">Role Access Matrix</h2>
          <p className="mt-1 text-xs text-mist/60">A practical baseline for who should do what inside the system.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-line bg-coal text-mist/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Area</th>
                <th className="px-4 py-3 font-semibold">ACIRE Owner</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Manager</th>
                <th className="px-4 py-3 font-semibold">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {roleMatrix.map(row => (
                <tr key={row.area}>
                  <td className="px-4 py-3 font-medium text-cream">{row.area}</td>
                  <td className="px-4 py-3 text-mist/70">{row.super_admin}</td>
                  <td className="px-4 py-3 text-mist/70">{row.owner}</td>
                  <td className="px-4 py-3 text-mist/70">{row.manager}</td>
                  <td className="px-4 py-3 text-mist/70">{row.staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
