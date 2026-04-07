'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Modal } from '@/components/ui/modal';
import { withTimeout } from '@/lib/with-timeout';
import { Loader2, RotateCcw } from 'lucide-react';

const DRAFT_KEY = 'gizops_draft_booking';

export interface Booking {
  id?: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  event_date: string;
  event_time: string;
  event_location: string;
  event_type: string;
  guest_count: string;
  package_description: string;
  quote_amount: string;
  deposit_amount: string;
  notes: string;
  status?: string;
}

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  booking?: Booking | null;
}

const empty: Booking = {
  client_name: '', client_email: '', client_phone: '',
  event_date: '', event_time: '', event_location: '',
  event_type: 'catering', guest_count: '',
  package_description: '', quote_amount: '', deposit_amount: '', notes: '',
};

export function BookingModal({ open, onClose, onSaved, booking }: BookingModalProps) {
  const supabase = createClientComponentClient();
  const [form, setForm] = useState<Booking>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const isEdit = !!booking?.id;

  // On open: restore draft (add mode only) or load booking for edit
  useEffect(() => {
    if (open) {
      setError(null);
      setDraftRestored(false);
      if (booking) {
        setForm({
          ...booking,
          guest_count: booking.guest_count?.toString() ?? '',
          quote_amount: booking.quote_amount?.toString() ?? '',
          deposit_amount: booking.deposit_amount?.toString() ?? '',
        });
      } else {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          try { setForm(JSON.parse(saved)); setDraftRestored(true); } catch { setForm(empty); }
        } else {
          setForm(empty);
        }
      }
    }
  }, [open, booking]);

  // Persist draft while typing (add mode only)
  useEffect(() => {
    if (open && !isEdit) {
      const hasContent = form.client_name || form.event_date || form.event_location;
      if (hasContent) localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }
  }, [form, open, isEdit]);

  const set = (k: keyof Booking, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name || !form.event_date) {
      setError('Client name and event date are required.');
      return;
    }
    setLoading(true);
    setError(null);

    const payload = {
      client_name: form.client_name,
      client_email: form.client_email || null,
      client_phone: form.client_phone || null,
      event_date: form.event_date,
      event_time: form.event_time || null,
      event_location: form.event_location || null,
      event_type: form.event_type || null,
      guest_count: form.guest_count ? parseInt(form.guest_count) : null,
      package_description: form.package_description || null,
      quote_amount: form.quote_amount ? parseFloat(form.quote_amount) : null,
      deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
      notes: form.notes || null,
      ...(isEdit ? {} : { status: 'inquiry' }),
    };

    try {
      const query = isEdit
        ? supabase.from('bookings').update(payload).eq('id', booking!.id)
        : supabase.from('bookings').insert(payload);
      const { error: dbErr } = await withTimeout(query as unknown as Promise<any>);
      if (dbErr) { setError(dbErr.message); setLoading(false); return; }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      return;
    }

    localStorage.removeItem(DRAFT_KEY);
    setLoading(false);
    onSaved(isEdit ? 'Booking updated' : 'Booking added');
    onClose();
  };

  const inp = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
  const lbl = 'block text-xs font-medium text-mist mb-1.5';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Booking' : 'Add Booking'}
      description="Log a catering inquiry, food truck event, or pop-up."
      className="max-w-xl"
    >
      {/* Draft restored notice */}
      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-900/30 border border-amber-700/50 px-3.5 py-2.5 mb-4">
          <p className="text-xs text-amber-200 flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            Draft restored from your last session.
          </p>
          <button
            type="button"
            onClick={() => { setForm(empty); setDraftRestored(false); localStorage.removeItem(DRAFT_KEY); }}
            className="text-xs text-amber-400 hover:text-amber-200 underline underline-offset-2 shrink-0 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Client */}
        <div>
          <label className={lbl}>Client name *</label>
          <input required className={inp} value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="e.g. Smith Family Reunion" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Email</label>
            <input type="email" className={inp} value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="client@email.com" />
          </div>
          <div>
            <label className={lbl}>Phone</label>
            <input type="tel" className={inp} value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="(301) 555-0100" />
          </div>
        </div>

        {/* Event */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Event date *</label>
            <input type="date" required className={inp} value={form.event_date} onChange={e => set('event_date', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Event time</label>
            <input className={inp} value={form.event_time} onChange={e => set('event_time', e.target.value)} placeholder="e.g. 6:00 PM" />
          </div>
        </div>
        <div>
          <label className={lbl}>Location</label>
          <input className={inp} value={form.event_location} onChange={e => set('event_location', e.target.value)} placeholder="Full address or venue name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Event type</label>
            <select className={inp} value={form.event_type} onChange={e => set('event_type', e.target.value)}>
              <option value="catering">Catering</option>
              <option value="food_truck">Food Truck</option>
              <option value="pop_up">Pop-Up</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Guest count</label>
            <input type="number" min="1" className={inp} value={form.guest_count} onChange={e => set('guest_count', e.target.value)} placeholder="0" />
          </div>
        </div>

        {/* Package */}
        <div>
          <label className={lbl}>Package / menu description</label>
          <textarea className={`${inp} resize-none`} rows={2} value={form.package_description} onChange={e => set('package_description', e.target.value)} placeholder="Describe the service package or menu..." />
        </div>

        {/* Financials */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Quote amount ($)</label>
            <input type="number" step="0.01" min="0" className={inp} value={form.quote_amount} onChange={e => set('quote_amount', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className={lbl}>Deposit amount ($)</label>
            <input type="number" step="0.01" min="0" className={inp} value={form.deposit_amount} onChange={e => set('deposit_amount', e.target.value)} placeholder="0.00" />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={lbl}>Notes</label>
          <textarea className={`${inp} resize-none`} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Dietary restrictions, special requests, internal notes..." />
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/60 border border-red-800/60 px-3.5 py-2.5">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-ember-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : (isEdit ? 'Save Changes' : 'Add Booking')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
