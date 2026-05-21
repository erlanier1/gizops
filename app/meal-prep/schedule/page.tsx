'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CalendarDays, ChefHat, CreditCard, MapPin, Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
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
  payment_status: string;
  status: 'active' | 'paused' | 'cancelled';
};

const STORAGE_KEY = 'gizops.meal-prep.clients.local';

const planLabels: Record<string, string> = {
  weekly_single: 'Weekly Single',
  weekly_family: 'Weekly Family',
  corporate: 'Corporate',
  daycare: 'Daycare',
};

function fmtDate(date: string | null) {
  if (!date) return 'No start date';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MealPrepSchedulePage() {
  const supabase = createClientComponentClient();
  const [clients, setClients] = useState<MealPrepClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [usesLocalStorage, setUsesLocalStorage] = useState(false);

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
      .neq('status', 'cancelled')
      .order('start_date', { ascending: true });

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

  const activeClients = clients.filter(client => client.status !== 'cancelled');
  const totalMeals = activeClients.reduce((sum, client) => sum + (client.meals_per_week ?? 0), 0);
  const daycareMeals = activeClients.filter(client => client.plan === 'daycare').reduce((sum, client) => sum + (client.meals_per_week ?? 0), 0);

  const groupedByWindow = useMemo(() => {
    return activeClients.reduce<Record<string, MealPrepClient[]>>((groups, client) => {
      const key = client.delivery_window || 'Unassigned delivery window';
      groups[key] = groups[key] ? [...groups[key], client] : [client];
      return groups;
    }, {});
  }, [activeClients]);

  return (
    <ModuleGate moduleKey="meal_prep">
    <div>
      <PageHeader
        title="Meal Prep Schedule"
        description="Weekly prep and delivery schedule generated from saved meal prep clients."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/meal-prep/clients" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Add Client
            </Link>
            <Link href="/meal-prep/payments" className="inline-flex items-center gap-1.5 rounded-lg bg-ember px-3 py-2 text-xs font-medium text-white hover:bg-ember-dark transition-colors">
              <CreditCard className="h-3.5 w-3.5" />
              Payments
            </Link>
          </div>
        }
      />

      {usesLocalStorage && (
        <div className="mb-5 rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-xs leading-5 text-amber-200">
          Schedule is reading local meal-prep client records because the `meal_prep_clients` table is not available yet.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Active Clients</p>
          <p className="text-2xl font-bold text-cream">{activeClients.length}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Meals / Week</p>
          <p className="text-2xl font-bold text-cream">{totalMeals}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Daycare Meals</p>
          <p className="text-2xl font-bold text-cream">{daycareMeals}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Delivery Windows</p>
          <p className="text-2xl font-bold text-cream">{Object.keys(groupedByWindow).length}</p>
        </div>
      </div>

      <div className="rounded-xl bg-smoke border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-ember" />
          <h2 className="text-sm font-semibold text-cream">Weekly Delivery Board</h2>
          <span className="text-xs text-mist">({activeClients.length})</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ember" /></div>
        ) : activeClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
              <ChefHat className="h-7 w-7 text-mist/40" />
            </div>
            <p className="text-sm font-semibold text-cream mb-2">No meal prep clients scheduled</p>
            <p className="text-xs text-mist/50 mb-6 max-w-xs">Add clients with delivery windows and they will appear on this weekly schedule.</p>
            <Link href="/meal-prep/clients" className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors">
              <Plus className="h-4 w-4" /> Add Client
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {Object.entries(groupedByWindow).map(([window, group]) => (
              <section key={window} className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-cream">{window}</h3>
                  <p className="text-xs text-mist">{group.reduce((sum, client) => sum + client.meals_per_week, 0)} meals · {group.length} clients</p>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {group.map(client => (
                    <div key={client.id} className="rounded-lg border border-line bg-coal px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-cream">{client.client_name}</p>
                          <p className="text-xs text-mist">{planLabels[client.plan] ?? client.plan}{client.child_name ? ` · ${client.child_name}` : ''}</p>
                        </div>
                        <span className="rounded-full border border-line bg-hover px-2 py-0.5 text-xs font-semibold text-mist">{client.meals_per_week} meals</span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-mist/70">
                        <p className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" />Starts {fmtDate(client.start_date)}</p>
                        <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{client.delivery_address || 'No delivery address'}</p>
                        <p className="flex items-center gap-1.5"><Users className="h-3 w-3" />{client.allergies ? `Allergies: ${client.allergies}` : 'No allergies listed'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
    </ModuleGate>
  );
}
