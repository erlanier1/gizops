'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { PageHeader } from '@/components/page-header';
import { BookingModal } from '@/components/bookings/booking-modal';
import { Toast } from '@/components/ui/toast';
import { ManagerAndAbove, OwnerOnly } from '@/components/RoleGuard';
import { useUser } from '@/lib/auth-context';
import { CalendarDays, Users, DollarSign, Plus, Pencil, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

type Stage = 'inquiry' | 'quoted' | 'confirmed' | 'completed';

interface DBBooking {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  event_type: string | null;
  guest_count: number | null;
  status: Stage;
  package_description: string | null;
  quote_amount: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  notes: string | null;
  created_at: string;
}

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: 'inquiry',   label: 'Inquiry',   color: 'text-mist' },
  { key: 'quoted',    label: 'Quoted',    color: 'text-amber-400' },
  { key: 'confirmed', label: 'Confirmed', color: 'text-green-400' },
  { key: 'completed', label: 'Completed', color: 'text-blue-400' },
];

const TYPE_STYLE: Record<string, string> = {
  catering:   'bg-blue-900/30 text-blue-400 border-blue-800',
  food_truck: 'bg-ember/20 text-ember border-ember/40',
  pop_up:     'bg-purple-900/30 text-purple-400 border-purple-800',
};
const TYPE_LABEL: Record<string, string> = {
  catering: 'Catering', food_truck: 'Food Truck', pop_up: 'Pop-Up',
};

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Spinner() {
  return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ember" /></div>;
}

export default function BookingsPage() {
  const supabase = createClientComponentClient();
  const { isStaff } = useUser();
  const [bookings, setBookings] = useState<DBBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DBBooking | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('bookings').select('*').order('event_date', { ascending: true });
    setBookings((data as DBBooking[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const move = async (id: string, newStatus: Stage) => {
    await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete booking for "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) { setToast({ message: 'Failed to delete booking.', type: 'error' }); return; }
    setToast({ message: 'Booking deleted.', type: 'success' });
    fetch();
  };

  const handleSaved = (msg: string) => { setToast({ message: msg, type: 'success' }); fetch(); };

  const openEdit = (b: DBBooking) => {
    setEditing({
      ...b,
      guest_count: b.guest_count?.toString() as any,
      quote_amount: b.quote_amount?.toString() as any,
      deposit_amount: b.deposit_amount?.toString() as any,
    });
    setModalOpen(true);
  };

  const byStage = (s: Stage) => bookings.filter(b => b.status === s);
  const confirmedValue = bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + (b.quote_amount ?? 0), 0);
  const pending = byStage('inquiry').length + byStage('quoted').length;

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Manage catering events, food truck spots, and private bookings."
        action={
          <ManagerAndAbove>
            <button
              onClick={() => { setEditing(null); setModalOpen(true); }}
              className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors"
            >
              <Plus className="h-4 w-4" /> New Booking
            </button>
          </ManagerAndAbove>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Total</p>
          <p className="text-2xl font-bold text-cream">{bookings.length}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Confirmed</p>
          <p className="text-2xl font-bold text-green-400">{byStage('confirmed').length}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{pending}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Confirmed Value</p>
          <p className="text-2xl font-bold text-cream">
            {isStaff ? '—' : confirmedValue > 0 ? `$${confirmedValue.toLocaleString()}` : '$0'}
          </p>
        </div>
      </div>

      {/* Kanban */}
      {loading ? <Spinner /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STAGES.map((stage, si) => {
            const cards = byStage(stage.key);
            return (
              <div key={stage.key} className="flex flex-col">
                <div className="flex items-center gap-2 px-1 mb-3">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
                  <span className="text-xs bg-hover text-mist rounded-full px-2 py-0.5">{cards.length}</span>
                </div>

                <div className="flex flex-col gap-3 min-h-[120px]">
                  {cards.length === 0 ? (
                    <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-line text-xs text-mist/40">
                      No {stage.label.toLowerCase()} bookings
                    </div>
                  ) : cards.map(b => (
                    <div key={b.id} className="rounded-xl bg-smoke border border-line p-4 hover:border-mist/20 transition-colors">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-cream leading-tight">{b.client_name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <ManagerAndAbove>
                            <button onClick={() => openEdit(b)} className="p-1 rounded text-mist hover:text-cream hover:bg-hover transition-colors">
                              <Pencil className="h-3 w-3" />
                            </button>
                          </ManagerAndAbove>
                          <OwnerOnly>
                            <button onClick={() => handleDelete(b.id, b.client_name)} className="p-1 rounded text-mist hover:text-red-400 hover:bg-red-900/20 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </OwnerOnly>
                        </div>
                      </div>

                      {/* Type badge */}
                      {b.event_type && (
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium mb-2 ${TYPE_STYLE[b.event_type] ?? 'bg-hover text-mist border-line'}`}>
                          {TYPE_LABEL[b.event_type] ?? b.event_type}
                        </span>
                      )}

                      {/* Details */}
                      <div className="space-y-1">
                        {b.event_date && (
                          <p className="text-xs text-mist flex items-center gap-1.5">
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            {fmtDate(b.event_date)}{b.event_time ? ` · ${b.event_time}` : ''}
                          </p>
                        )}
                        {b.guest_count != null && (
                          <p className="text-xs text-mist flex items-center gap-1.5">
                            <Users className="h-3 w-3 shrink-0" />{b.guest_count} guests
                          </p>
                        )}
                        {b.quote_amount != null && (
                          isStaff ? (
                            <p className="text-xs text-mist flex items-center gap-1.5">
                              <DollarSign className="h-3 w-3 shrink-0" />---
                            </p>
                          ) : (
                            <p className="text-xs font-semibold text-cream flex items-center gap-1.5">
                              <DollarSign className="h-3 w-3 shrink-0 text-mist" />${b.quote_amount.toLocaleString()}
                            </p>
                          )
                        )}
                      </div>

                      {/* Move buttons — manager+ only */}
                      <ManagerAndAbove>
                        <div className="flex gap-1.5 mt-3 pt-3 border-t border-line">
                          {si > 0 && (
                            <button
                              onClick={() => move(b.id, STAGES[si - 1].key)}
                              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-line py-1.5 text-xs text-mist hover:bg-hover hover:text-cream transition-colors"
                            >
                              <ChevronLeft className="h-3 w-3" />{STAGES[si - 1].label}
                            </button>
                          )}
                          {si < STAGES.length - 1 && (
                            <button
                              onClick={() => move(b.id, STAGES[si + 1].key)}
                              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-line py-1.5 text-xs text-mist hover:bg-hover hover:text-cream transition-colors"
                            >
                              {STAGES[si + 1].label}<ChevronRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </ManagerAndAbove>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={handleSaved} booking={editing as any} />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
