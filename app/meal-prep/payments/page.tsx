'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Copy, CreditCard, ExternalLink, Loader2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Toast } from '@/components/ui/toast';
import { ModuleGate } from '@/components/ModuleGate';

type MealPrepClient = {
  id: string;
  client_name: string;
  email: string;
  plan: string;
  child_name: string | null;
  start_date: string | null;
  delivery_window: string | null;
  deposit_amount: number;
  payment_status: 'pending' | 'deposit_paid' | 'invoiced' | 'paid' | 'cancelled';
  stripe_checkout_session_id: string | null;
  stripe_payment_link: string | null;
  status: 'active' | 'paused' | 'cancelled';
};

const STORAGE_KEY = 'gizops.meal-prep.clients.local';

const planLabels: Record<string, string> = {
  weekly_single: 'Weekly Single',
  weekly_family: 'Weekly Family',
  corporate: 'Corporate',
  daycare: 'Daycare',
};

function fmtMoney(value: number | null | undefined) {
  return (value ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function statusClass(status: MealPrepClient['payment_status']) {
  if (status === 'paid' || status === 'deposit_paid') return 'bg-green-900/30 border-green-800 text-green-400';
  if (status === 'invoiced') return 'bg-blue-900/30 border-blue-800 text-blue-400';
  if (status === 'cancelled') return 'bg-red-900/30 border-red-800 text-red-400';
  return 'bg-amber-900/30 border-amber-800 text-amber-400';
}

export default function MealPrepPaymentsPage() {
  const supabase = createClientComponentClient();
  const [clients, setClients] = useState<MealPrepClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [usesLocalStorage, setUsesLocalStorage] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const saveLocal = useCallback((nextClients: MealPrepClient[]) => {
    setClients(nextClients);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextClients));
  }, []);

  const loadLocal = useCallback(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setClients(stored ? JSON.parse(stored) as MealPrepClient[] : []);
    setUsesLocalStorage(true);
  }, []);

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

  const stats = useMemo(() => {
    const outstanding = clients
      .filter(client => client.status !== 'cancelled' && !['paid', 'deposit_paid'].includes(client.payment_status))
      .reduce((sum, client) => sum + (client.deposit_amount ?? 0), 0);
    const paid = clients.filter(client => ['paid', 'deposit_paid'].includes(client.payment_status)).length;
    return { outstanding, paid, total: clients.length };
  }, [clients]);

  const copyLink = async (url: string | null) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setToast({ message: 'Payment link copied.', type: 'success' });
  };

  const createLink = async (client: MealPrepClient) => {
    setCreatingId(client.id);
    try {
      const response = await fetch('/api/payments/deposit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealPrepClientId: client.id,
          clientName: client.client_name,
          email: client.email,
          eventDate: client.start_date,
          eventType: 'meal_prep',
          amount: client.deposit_amount,
          description: `${planLabels[client.plan] ?? client.plan} meal prep deposit`,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to create payment link.');

      const updated = {
        ...client,
        stripe_payment_link: body.url,
        stripe_checkout_session_id: body.sessionId,
        payment_status: 'pending' as const,
      };

      if (usesLocalStorage) {
        saveLocal(clients.map(item => item.id === client.id ? updated : item));
      } else {
        await supabase
          .from('meal_prep_clients')
          .update({
            stripe_payment_link: body.url,
            stripe_checkout_session_id: body.sessionId,
            payment_status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', client.id);
        setClients(prev => prev.map(item => item.id === client.id ? updated : item));
      }

      setToast({ message: 'Payment link created.', type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Failed to create payment link.', type: 'error' });
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <ModuleGate moduleKey="meal_prep">
    <div>
      <PageHeader
        title="Meal Prep Payments"
        description="Track deposits, outstanding balances, and Stripe links for meal prep clients."
        action={
          <Link href="/meal-prep/clients" className="inline-flex items-center gap-1.5 rounded-lg bg-ember px-3 py-2 text-xs font-medium text-white hover:bg-ember-dark transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Add Client
          </Link>
        }
      />

      {usesLocalStorage && (
        <div className="mb-5 rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-xs leading-5 text-amber-200">
          Payments are reading local meal-prep client records because the `meal_prep_clients` table is not available yet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Clients</p>
          <p className="text-2xl font-bold text-cream">{stats.total}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Paid Deposits</p>
          <p className="text-2xl font-bold text-green-400">{stats.paid}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Outstanding Deposits</p>
          <p className="text-2xl font-bold text-amber-400">{fmtMoney(stats.outstanding)}</p>
        </div>
      </div>

      <div className="rounded-xl bg-smoke border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-ember" />
          <h2 className="text-sm font-semibold text-cream">Client Payment Links</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ember" /></div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
              <CreditCard className="h-7 w-7 text-mist/40" />
            </div>
            <p className="text-sm font-semibold text-cream">No meal prep payment records yet</p>
            <p className="mt-1 max-w-sm text-xs text-mist/50">Add a meal prep client to create deposit links and track payment status.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {clients.map(client => (
              <div key={client.id} className="grid gap-4 px-5 py-4 hover:bg-hover/30 transition-colors lg:grid-cols-[minmax(0,1fr)_150px_160px_230px] lg:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-cream">{client.client_name}</p>
                  <p className="mt-1 text-xs text-mist">{client.email} · {planLabels[client.plan] ?? client.plan}{client.child_name ? ` · ${client.child_name}` : ''}</p>
                  <p className="mt-1 text-xs text-mist/70">{client.delivery_window || 'No delivery window'} · starts {client.start_date || 'not scheduled'}</p>
                </div>
                <div>
                  <p className="text-xs text-mist/50">Deposit</p>
                  <p className="text-sm font-semibold text-cream">{fmtMoney(client.deposit_amount)}</p>
                </div>
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(client.payment_status)}`}>
                    {client.payment_status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {client.stripe_payment_link ? (
                    <>
                      <button type="button" onClick={() => copyLink(client.stripe_payment_link)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </button>
                      <a href={client.stripe_payment_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </a>
                    </>
                  ) : (
                    <button type="button" onClick={() => createLink(client)} disabled={creatingId === client.id} className="inline-flex items-center gap-1.5 rounded-lg bg-ember px-3 py-2 text-xs font-medium text-white hover:bg-ember-dark disabled:opacity-60 transition-colors">
                      {creatingId === client.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                      Create Link
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-line bg-smoke p-5">
        <p className="text-sm font-semibold text-cream mb-1">Payment privacy</p>
        <p className="text-xs leading-5 text-mist/70">
          Card information is not stored in GizOps. Payments are processed by Stripe; we only capture contact information and payment status needed for client follow-up.
        </p>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
    </ModuleGate>
  );
}
