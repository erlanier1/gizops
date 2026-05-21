'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AlertTriangle, CalendarDays, Copy, CreditCard, ExternalLink, Loader2, MapPin, Save, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Toast } from '@/components/ui/toast';
import { ModuleGate } from '@/components/ModuleGate';

type MealPrepClient = {
  id: string;
  client_name: string;
  email: string;
  phone: string | null;
  plan: string;
  child_name: string | null;
  start_date: string | null;
  delivery_address: string | null;
  delivery_window: string | null;
  meals_per_week: number;
  dietary_notes: string | null;
  allergies: string | null;
  deposit_amount: number;
  payment_status: 'pending' | 'deposit_paid' | 'invoiced' | 'paid' | 'cancelled';
  stripe_checkout_session_id: string | null;
  stripe_payment_link: string | null;
  status: 'active' | 'paused' | 'cancelled';
  created_at?: string;
  updated_at?: string;
};

const inputClass = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
const labelClass = 'block text-xs font-medium text-mist mb-1.5';
const STORAGE_KEY = 'gizops.meal-prep.clients.local';

const initialClient = {
  clientName: '',
  email: '',
  phone: '',
  plan: 'weekly_family',
  childName: '',
  startDate: '',
  deliveryAddress: '',
  deliveryWindow: '',
  mealsPerWeek: '5',
  dietaryNotes: '',
  allergies: '',
  amount: '50',
};

const planLabels: Record<string, string> = {
  weekly_single: 'Weekly Single Plan',
  weekly_family: 'Weekly Family Plan',
  corporate: 'Corporate Meal Prep',
  daycare: 'Daycare Meal Prep',
};

const seedClients: MealPrepClient[] = [
  {
    id: 'local-daycare-sample',
    client_name: 'Little Steps Daycare',
    email: 'director@example.com',
    phone: '(555) 123-9911',
    plan: 'daycare',
    child_name: 'Group order',
    start_date: '',
    delivery_address: '123 Learning Ln',
    delivery_window: 'Mondays, 10 AM',
    meals_per_week: 25,
    dietary_notes: 'Kid-friendly lunches, mild seasoning',
    allergies: 'Nut-free',
    deposit_amount: 150,
    payment_status: 'pending',
    stripe_checkout_session_id: null,
    stripe_payment_link: null,
    status: 'active',
  },
];

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusClass(status: MealPrepClient['payment_status']) {
  if (status === 'paid' || status === 'deposit_paid') return 'bg-green-900/30 border-green-800 text-green-400';
  if (status === 'invoiced') return 'bg-blue-900/30 border-blue-800 text-blue-400';
  if (status === 'cancelled') return 'bg-red-900/30 border-red-800 text-red-400';
  return 'bg-amber-900/30 border-amber-800 text-amber-400';
}

export default function MealPrepClientsPage() {
  const supabase = createClientComponentClient();
  const [client, setClient] = useState(initialClient);
  const [clients, setClients] = useState<MealPrepClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [usesLocalStorage, setUsesLocalStorage] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const saveLocal = useCallback((nextClients: MealPrepClient[]) => {
    setClients(nextClients);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextClients));
  }, []);

  const loadLocal = useCallback(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const localClients = stored ? JSON.parse(stored) as MealPrepClient[] : seedClients;
    saveLocal(localClients);
    setUsesLocalStorage(true);
  }, [saveLocal]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('meal_prep_clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      loadLocal();
      setLoading(false);
      return;
    }

    setUsesLocalStorage(false);
    setClients((data as MealPrepClient[]) ?? []);
    setLoading(false);
  }, [loadLocal, supabase]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const set = (key: keyof typeof initialClient, value: string) => {
    setClient(prev => ({ ...prev, [key]: value }));
  };

  const payloadFromForm = () => ({
    client_name: client.clientName.trim(),
    email: client.email.trim(),
    phone: client.phone.trim() || null,
    plan: client.plan,
    child_name: client.plan === 'daycare' ? client.childName.trim() || null : null,
    start_date: client.startDate || null,
    delivery_address: client.deliveryAddress.trim() || null,
    delivery_window: client.deliveryWindow.trim() || null,
    meals_per_week: Math.max(1, Math.round(toNumber(client.mealsPerWeek))),
    dietary_notes: client.dietaryNotes.trim() || null,
    allergies: client.allergies.trim() || null,
    deposit_amount: toNumber(client.amount),
    payment_status: 'pending' as const,
    status: 'active' as const,
    updated_at: new Date().toISOString(),
  });

  const saveClient = async () => {
    if (!client.clientName || !client.email) {
      setToast({ message: 'Client name and email are required.', type: 'error' });
      return null;
    }

    setSaving(true);
    const payload = payloadFromForm();

    if (usesLocalStorage) {
      const localClient: MealPrepClient = {
        id: selectedClientId ?? crypto.randomUUID(),
        ...payload,
        stripe_checkout_session_id: null,
        stripe_payment_link: null,
      };
      const nextClients = selectedClientId
        ? clients.map(item => item.id === selectedClientId ? { ...item, ...localClient } : item)
        : [localClient, ...clients];
      saveLocal(nextClients);
      setSelectedClientId(localClient.id);
      setToast({ message: 'Meal prep client saved locally.', type: 'success' });
      setSaving(false);
      return localClient;
    }

    const request = selectedClientId
      ? supabase.from('meal_prep_clients').update(payload).eq('id', selectedClientId).select().single()
      : supabase.from('meal_prep_clients').insert(payload).select().single();

    const { data, error } = await request;
    setSaving(false);

    if (error) {
      setToast({ message: error.message || 'Failed to save meal prep client.', type: 'error' });
      return null;
    }

    const saved = data as MealPrepClient;
    setSelectedClientId(saved.id);
    setClients(prev => selectedClientId
      ? prev.map(item => item.id === saved.id ? saved : item)
      : [saved, ...prev]);
    setToast({ message: 'Meal prep client saved.', type: 'success' });
    return saved;
  };

  const createPaymentLink = async () => {
    if (!client.clientName || !client.email || !client.amount) {
      setToast({ message: 'Name, email, and deposit amount are required.', type: 'error' });
      return;
    }

    setCreatingPayment(true);
    setPaymentUrl('');

    try {
      const savedClient = selectedClientId
        ? clients.find(item => item.id === selectedClientId) ?? await saveClient()
        : await saveClient();

      if (!savedClient) return;

      const response = await fetch('/api/payments/deposit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealPrepClientId: savedClient.id,
          clientName: client.clientName,
          email: client.email,
          eventDate: client.startDate,
          eventType: 'meal_prep',
          amount: client.amount,
          description: client.plan === 'daycare' && client.childName
            ? `${planLabels[client.plan]} deposit for ${client.childName}`
            : `${planLabels[client.plan]} deposit`,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to create payment link.');

      setPaymentUrl(body.url);

      const updatedClient = {
        ...savedClient,
        stripe_checkout_session_id: body.sessionId,
        stripe_payment_link: body.url,
        payment_status: 'pending' as const,
        updated_at: new Date().toISOString(),
      };

      if (usesLocalStorage) {
        saveLocal(clients.map(item => item.id === savedClient.id ? updatedClient : item));
      } else {
        await supabase
          .from('meal_prep_clients')
          .update({
            stripe_checkout_session_id: body.sessionId,
            stripe_payment_link: body.url,
            payment_status: 'pending',
            updated_at: updatedClient.updated_at,
          })
          .eq('id', savedClient.id);
        setClients(prev => prev.map(item => item.id === savedClient.id ? updatedClient : item));
      }

      setToast({ message: 'Stripe payment link created and attached to the client.', type: 'success' });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Failed to create payment link.',
        type: 'error',
      });
    } finally {
      setCreatingPayment(false);
    }
  };

  const copyPaymentUrl = async () => {
    if (!paymentUrl) return;
    await navigator.clipboard.writeText(paymentUrl);
    setToast({ message: 'Payment link copied.', type: 'success' });
  };

  const loadClient = (item: MealPrepClient) => {
    setSelectedClientId(item.id);
    setClient({
      clientName: item.client_name,
      email: item.email,
      phone: item.phone ?? '',
      plan: item.plan,
      childName: item.child_name ?? '',
      startDate: item.start_date ?? '',
      deliveryAddress: item.delivery_address ?? '',
      deliveryWindow: item.delivery_window ?? '',
      mealsPerWeek: item.meals_per_week.toString(),
      dietaryNotes: item.dietary_notes ?? '',
      allergies: item.allergies ?? '',
      amount: item.deposit_amount.toString(),
    });
    setPaymentUrl(item.stripe_payment_link ?? '');
  };

  const resetForm = () => {
    setSelectedClientId(null);
    setClient(initialClient);
    setPaymentUrl('');
  };

  return (
    <ModuleGate moduleKey="meal_prep">
    <div>
      <PageHeader
        title="Meal Prep Clients"
        description="Add new meal prep clients, save intake details, and create a Stripe deposit link."
        action={
          <Link
            href="/meal-prep/payments"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Payments
          </Link>
        }
      />

      {usesLocalStorage && (
        <div className="mb-5 rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-xs leading-5 text-amber-200">
          Meal prep clients are running in local mode because the `meal_prep_clients` table is not available yet. You can test the workflow here, then run the Supabase SQL file to make records shared and persistent.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-xl bg-smoke border border-line p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ember/15 border border-ember/30">
                <UserPlus className="h-5 w-5 text-ember" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-cream">New Client Intake</h2>
                <p className="text-xs text-mist/60">{selectedClientId ? 'Editing saved client record.' : 'Save the client before sending a payment link.'}</p>
              </div>
            </div>
            <button type="button" onClick={resetForm} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
              New Client
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="clientName" className={labelClass}>Client name</label>
              <input id="clientName" className={inputClass} value={client.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" type="email" className={inputClass} value={client.email} onChange={e => set('email', e.target.value)} placeholder="client@example.com" />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>Phone</label>
              <input id="phone" className={inputClass} value={client.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label htmlFor="plan" className={labelClass}>Meal prep plan</label>
              <select id="plan" className={inputClass} value={client.plan} onChange={e => set('plan', e.target.value)}>
                <option value="weekly_single">Weekly Single Plan</option>
                <option value="weekly_family">Weekly Family Plan</option>
                <option value="corporate">Corporate Meal Prep</option>
                <option value="daycare">Daycare Meal Prep</option>
              </select>
            </div>
            <div>
              <label htmlFor="startDate" className={labelClass}>Start date</label>
              <input id="startDate" type="date" className={inputClass} value={client.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            {client.plan === 'daycare' && (
              <div>
                <label htmlFor="childName" className={labelClass}>Child&apos;s name</label>
                <input id="childName" className={inputClass} value={client.childName} onChange={e => set('childName', e.target.value)} placeholder="Child name or classroom" />
              </div>
            )}
            <div>
              <label htmlFor="deliveryWindow" className={labelClass}>Delivery window</label>
              <input id="deliveryWindow" className={inputClass} value={client.deliveryWindow} onChange={e => set('deliveryWindow', e.target.value)} placeholder="Mondays, 4-6 PM" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="deliveryAddress" className={labelClass}>Delivery address</label>
              <input id="deliveryAddress" className={inputClass} value={client.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)} placeholder="123 Main St, City, ST" />
            </div>
            <div>
              <label htmlFor="mealsPerWeek" className={labelClass}>Meals per week</label>
              <input id="mealsPerWeek" type="number" min="1" className={inputClass} value={client.mealsPerWeek} onChange={e => set('mealsPerWeek', e.target.value)} />
            </div>
            <div>
              <label htmlFor="amount" className={labelClass}>Deposit amount ($)</label>
              <input id="amount" type="number" min="1" step="0.01" className={inputClass} value={client.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div>
              <label htmlFor="dietaryNotes" className={labelClass}>Dietary preferences</label>
              <textarea id="dietaryNotes" className={`${inputClass} min-h-[110px] resize-none`} value={client.dietaryNotes} onChange={e => set('dietaryNotes', e.target.value)} placeholder="High protein, low sodium, no pork..." />
            </div>
            <div>
              <label htmlFor="allergies" className={labelClass}>Allergies / restrictions</label>
              <textarea id="allergies" className={`${inputClass} min-h-[110px] resize-none`} value={client.allergies} onChange={e => set('allergies', e.target.value)} placeholder="Shellfish allergy, gluten-free..." />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <div className="basis-full rounded-lg border border-line bg-coal px-3 py-2 text-xs leading-5 text-mist/70">
              Card information is not stored in GizOps. Payments are processed by Stripe; we only capture contact information needed for meal prep intake and follow-up.
            </div>

            <button type="button" onClick={saveClient} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-mist hover:bg-hover hover:text-cream disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Client
            </button>

            <button type="button" onClick={createPaymentLink} disabled={creatingPayment || saving} className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark disabled:opacity-60 transition-colors">
              {creatingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Create Stripe Link
            </button>

            {paymentUrl && (
              <>
                <button type="button" onClick={copyPaymentUrl} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
                  <Copy className="h-4 w-4" />
                  Copy Link
                </button>
                <a href={paymentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
                  <ExternalLink className="h-4 w-4" />
                  Open Stripe
                </a>
              </>
            )}
          </div>

          {paymentUrl && (
            <div className="mt-4 rounded-lg bg-coal border border-line px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-mist/50 mb-1">Generated payment link</p>
              <p className="break-all text-xs text-cream">{paymentUrl}</p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-ember" />
              <h2 className="text-sm font-semibold text-cream">Saved Clients</h2>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ember" /></div>
            ) : clients.length === 0 ? (
              <p className="rounded-lg border border-line bg-coal px-3 py-6 text-center text-xs text-mist/60">No meal prep clients saved yet.</p>
            ) : (
              <div className="space-y-3">
                {clients.slice(0, 8).map(item => (
                  <button key={item.id} type="button" onClick={() => loadClient(item)} className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${selectedClientId === item.id ? 'border-ember bg-ember/10' : 'border-line bg-coal hover:bg-hover'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-cream">{item.client_name}</p>
                        <p className="text-xs text-mist">{planLabels[item.plan] ?? item.plan}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(item.payment_status)}`}>
                        {item.payment_status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-mist/70">
                      <p className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" />{item.start_date || 'No start date'} · {item.delivery_window || 'No delivery window'}</p>
                      <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{item.delivery_address || 'No address'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-ember" />
              <p className="text-sm font-semibold text-cream">Data note</p>
            </div>
            <p className="text-xs leading-5 text-mist/70">
              New clients save to `meal_prep_clients` when the table exists. Stripe payment links store only contact and payment status metadata in GizOps.
            </p>
          </div>
        </aside>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
    </ModuleGate>
  );
}
