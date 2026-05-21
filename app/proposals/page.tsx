'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  CalendarDays,
  Copy,
  Download,
  FileSignature,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Toast } from '@/components/ui/toast';
import { ManagerAndAbove, OwnerOnly } from '@/components/RoleGuard';
import { useBusinessProfile, type BusinessProfile } from '@/lib/business-profile';
import { ModuleGate } from '@/components/ModuleGate';

type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

type BookingOption = {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  guest_count: number | null;
  package_description: string | null;
  quote_amount: number | null;
  deposit_amount: number | null;
};

type Proposal = {
  id: string;
  booking_id: string | null;
  proposal_number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  guest_count: number | null;
  menu_summary: string | null;
  service_terms: string | null;
  total_amount: number;
  deposit_amount: number;
  due_date: string | null;
  status: ProposalStatus;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

type ProposalForm = {
  booking_id: string;
  proposal_number: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  event_date: string;
  event_time: string;
  event_location: string;
  guest_count: string;
  menu_summary: string;
  service_terms: string;
  total_amount: string;
  deposit_amount: string;
  due_date: string;
  status: ProposalStatus;
  notes: string;
};

const STORAGE_KEY = 'gizops.catering-proposals.local';

const emptyForm: ProposalForm = {
  booking_id: '',
  proposal_number: '',
  client_name: '',
  client_email: '',
  client_phone: '',
  event_date: '',
  event_time: '',
  event_location: '',
  guest_count: '',
  menu_summary: '',
  service_terms: 'A non-refundable deposit is required to reserve the event date. Final guest count and menu selections are due 7 days before the event. Remaining balance is due before service unless otherwise agreed in writing.',
  total_amount: '',
  deposit_amount: '',
  due_date: '',
  status: 'draft',
  notes: '',
};

const statusOptions: { value: ProposalStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

const inputClass = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
const labelClass = 'block text-xs font-medium text-mist mb-1.5';

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtMoney(value: number | string | null | undefined) {
  const numeric = typeof value === 'string' ? toNumber(value) : value ?? 0;
  return numeric.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(value: string | null | undefined) {
  if (!value) return 'TBD';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function nextProposalNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `ZK-${stamp}-${Math.floor(100 + Math.random() * 900)}`;
}

function statusClass(status: ProposalStatus) {
  if (status === 'accepted') return 'bg-green-900/30 border-green-800 text-green-400';
  if (status === 'sent') return 'bg-blue-900/30 border-blue-800 text-blue-400';
  if (status === 'declined' || status === 'expired') return 'bg-red-900/30 border-red-800 text-red-400';
  return 'bg-amber-900/30 border-amber-800 text-amber-400';
}

function proposalToForm(proposal: Proposal): ProposalForm {
  return {
    booking_id: proposal.booking_id ?? '',
    proposal_number: proposal.proposal_number,
    client_name: proposal.client_name,
    client_email: proposal.client_email ?? '',
    client_phone: proposal.client_phone ?? '',
    event_date: proposal.event_date ?? '',
    event_time: proposal.event_time ?? '',
    event_location: proposal.event_location ?? '',
    guest_count: proposal.guest_count?.toString() ?? '',
    menu_summary: proposal.menu_summary ?? '',
    service_terms: proposal.service_terms ?? emptyForm.service_terms,
    total_amount: proposal.total_amount?.toString() ?? '',
    deposit_amount: proposal.deposit_amount?.toString() ?? '',
    due_date: proposal.due_date ?? '',
    status: proposal.status,
    notes: proposal.notes ?? '',
  };
}

function formToPayload(form: ProposalForm) {
  return {
    booking_id: form.booking_id || null,
    proposal_number: form.proposal_number || nextProposalNumber(),
    client_name: form.client_name.trim(),
    client_email: form.client_email.trim() || null,
    client_phone: form.client_phone.trim() || null,
    event_date: form.event_date || null,
    event_time: form.event_time.trim() || null,
    event_location: form.event_location.trim() || null,
    guest_count: form.guest_count ? Math.round(toNumber(form.guest_count)) : null,
    menu_summary: form.menu_summary.trim() || null,
    service_terms: form.service_terms.trim() || null,
    total_amount: toNumber(form.total_amount),
    deposit_amount: toNumber(form.deposit_amount),
    due_date: form.due_date || null,
    status: form.status,
    notes: form.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function buildProposalHtml(form: ProposalForm, business: BusinessProfile) {
  const businessAddress = [business.address, business.city, business.state, business.postal_code].filter(Boolean).join(', ');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${form.proposal_number || 'Catering Proposal'}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f2933; line-height: 1.5; padding: 32px; }
    h1 { margin: 0 0 6px; color: #111827; }
    h2 { margin-top: 28px; border-bottom: 1px solid #d7dde5; padding-bottom: 6px; color: #111827; }
    .meta { color: #64748b; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
    .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .value { margin-bottom: 10px; }
    .money { font-size: 18px; font-weight: 700; }
    .terms { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${business.business_name} Catering Proposal & Agreement</h1>
  <p class="meta">Proposal ${form.proposal_number || 'Draft'} · Generated ${fmtDate(new Date().toISOString().slice(0, 10))}</p>
  <p class="meta">${business.legal_name || business.business_name}${businessAddress ? ` · ${businessAddress}` : ''}${business.contact_phone ? ` · ${business.contact_phone}` : ''}</p>

  <h2>Client</h2>
  <div class="grid">
    <div><div class="label">Client</div><div class="value">${form.client_name || 'TBD'}</div></div>
    <div><div class="label">Email</div><div class="value">${form.client_email || 'TBD'}</div></div>
    <div><div class="label">Phone</div><div class="value">${form.client_phone || 'TBD'}</div></div>
    <div><div class="label">Proposal Due Date</div><div class="value">${fmtDate(form.due_date)}</div></div>
  </div>

  <h2>Event Details</h2>
  <div class="grid">
    <div><div class="label">Event Date</div><div class="value">${fmtDate(form.event_date)}</div></div>
    <div><div class="label">Event Time</div><div class="value">${form.event_time || 'TBD'}</div></div>
    <div><div class="label">Guest Count</div><div class="value">${form.guest_count || 'TBD'}</div></div>
    <div><div class="label">Location</div><div class="value">${form.event_location || 'TBD'}</div></div>
  </div>

  <h2>Menu & Service</h2>
  <p class="terms">${form.menu_summary || 'Menu and service details to be confirmed.'}</p>

  <h2>Pricing</h2>
  <div class="grid">
    <div><div class="label">Total Amount</div><div class="money">${fmtMoney(form.total_amount)}</div></div>
    <div><div class="label">Deposit Required</div><div class="money">${fmtMoney(form.deposit_amount)}</div></div>
  </div>

  <h2>Terms</h2>
  <p class="terms">${form.service_terms || emptyForm.service_terms}</p>

  <h2>Acceptance</h2>
  <p>By approving this proposal, the client agrees to the menu, event details, pricing, deposit requirement, and service terms listed above.</p>
  <p style="margin-top: 40px;">Client Signature: __________________________________ Date: ______________</p>
</body>
</html>`;
}

export default function ProposalsPage() {
  const supabase = createClientComponentClient();
  const { business } = useBusinessProfile();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [form, setForm] = useState<ProposalForm>({ ...emptyForm, proposal_number: nextProposalNumber() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usesLocalStorage, setUsesLocalStorage] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const saveLocal = useCallback((nextProposals: Proposal[]) => {
    setProposals(nextProposals);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProposals));
  }, []);

  const loadLocal = useCallback(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setProposals(stored ? JSON.parse(stored) as Proposal[] : []);
    setUsesLocalStorage(true);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [proposalResult, bookingResult] = await Promise.all([
      supabase.from('catering_proposals').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('id, client_name, client_email, client_phone, event_date, event_time, event_location, guest_count, package_description, quote_amount, deposit_amount').eq('event_type', 'catering').order('event_date', { ascending: true }),
    ]);

    if (proposalResult.error) {
      loadLocal();
    } else {
      setUsesLocalStorage(false);
      setProposals((proposalResult.data as Proposal[]) ?? []);
    }

    setBookings((bookingResult.data as BookingOption[]) ?? []);
    setLoading(false);
  }, [loadLocal, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return proposals.filter(proposal =>
      `${proposal.proposal_number} ${proposal.client_name} ${proposal.client_email ?? ''} ${proposal.event_location ?? ''}`.toLowerCase().includes(needle)
    );
  }, [proposals, query]);

  const stats = useMemo(() => {
    const totalValue = proposals.reduce((sum, proposal) => sum + (proposal.total_amount ?? 0), 0);
    return {
      total: proposals.length,
      drafts: proposals.filter(proposal => proposal.status === 'draft').length,
      sent: proposals.filter(proposal => proposal.status === 'sent').length,
      accepted: proposals.filter(proposal => proposal.status === 'accepted').length,
      totalValue,
    };
  }, [proposals]);

  const set = (key: keyof ProposalForm, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const applyBooking = (bookingId: string) => {
    const booking = bookings.find(item => item.id === bookingId);
    set('booking_id', bookingId);
    if (!booking) return;
    setForm(prev => ({
      ...prev,
      booking_id: booking.id,
      client_name: booking.client_name,
      client_email: booking.client_email ?? '',
      client_phone: booking.client_phone ?? '',
      event_date: booking.event_date ?? '',
      event_time: booking.event_time ?? '',
      event_location: booking.event_location ?? '',
      guest_count: booking.guest_count?.toString() ?? '',
      menu_summary: booking.package_description ?? prev.menu_summary,
      total_amount: booking.quote_amount?.toString() ?? prev.total_amount,
      deposit_amount: booking.deposit_amount?.toString() ?? prev.deposit_amount,
    }));
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm({ ...emptyForm, proposal_number: nextProposalNumber() });
  };

  const saveProposal = async () => {
    if (!form.client_name.trim()) {
      setToast({ message: 'Client name is required.', type: 'error' });
      return;
    }

    setSaving(true);
    const payload = formToPayload(form);

    if (usesLocalStorage) {
      const localProposal: Proposal = {
        id: selectedId ?? crypto.randomUUID(),
        ...payload,
      };
      const next = selectedId
        ? proposals.map(proposal => proposal.id === selectedId ? { ...proposal, ...localProposal } : proposal)
        : [localProposal, ...proposals];
      saveLocal(next);
      setSelectedId(localProposal.id);
      setToast({ message: 'Proposal saved locally.', type: 'success' });
      setSaving(false);
      return;
    }

    const request = selectedId
      ? supabase.from('catering_proposals').update(payload).eq('id', selectedId).select().single()
      : supabase.from('catering_proposals').insert(payload).select().single();

    const { data, error } = await request;
    setSaving(false);

    if (error) {
      setToast({ message: error.message || 'Failed to save proposal.', type: 'error' });
      return;
    }

    const saved = data as Proposal;
    setSelectedId(saved.id);
    setProposals(prev => selectedId
      ? prev.map(proposal => proposal.id === saved.id ? saved : proposal)
      : [saved, ...prev]);
    setToast({ message: 'Proposal saved.', type: 'success' });
  };

  const loadProposal = (proposal: Proposal) => {
    setSelectedId(proposal.id);
    setForm(proposalToForm(proposal));
  };

  const deleteProposal = async (proposal: Proposal) => {
    if (!window.confirm(`Delete proposal ${proposal.proposal_number}? This cannot be undone.`)) return;

    if (usesLocalStorage) {
      saveLocal(proposals.filter(item => item.id !== proposal.id));
      if (selectedId === proposal.id) resetForm();
      setToast({ message: 'Proposal deleted locally.', type: 'success' });
      return;
    }

    const { error } = await supabase.from('catering_proposals').delete().eq('id', proposal.id);
    if (error) {
      setToast({ message: 'Failed to delete proposal.', type: 'error' });
      return;
    }
    setProposals(prev => prev.filter(item => item.id !== proposal.id));
    if (selectedId === proposal.id) resetForm();
    setToast({ message: 'Proposal deleted.', type: 'success' });
  };

  const downloadProposal = (proposalForm = form) => {
    const html = buildProposalHtml(proposalForm, business);
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${proposalForm.proposal_number || 'catering-proposal'}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyEmailDraft = async () => {
    const draft = `Hi ${form.client_name || 'there'},\n\nAttached is your catering proposal for ${fmtDate(form.event_date)}. The total is ${fmtMoney(form.total_amount)} with a deposit of ${fmtMoney(form.deposit_amount)} to reserve the date.\n\nPlease review the details and let us know if you would like any changes.\n\n${business.proposal_footer || `Thank you,\n${business.business_name}`}`;
    await navigator.clipboard.writeText(draft);
    setToast({ message: 'Email draft copied.', type: 'success' });
  };

  return (
    <ModuleGate moduleKey="proposals">
    <div>
      <PageHeader
        title="Catering Proposals"
        description="Create, store, and download contract proposals for catering events."
        action={
          <ManagerAndAbove>
            <button onClick={resetForm} className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors">
              <Plus className="h-4 w-4" /> New Proposal
            </button>
          </ManagerAndAbove>
        }
      />

      {usesLocalStorage && (
        <div className="mb-5 rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-xs leading-5 text-amber-200">
          Proposals are running in local mode because the `catering_proposals` table is not available yet. You can test the workflow now, then run the Supabase SQL file for shared storage.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Proposals</p>
          <p className="text-2xl font-bold text-cream">{stats.total}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Draft / Sent</p>
          <p className="text-2xl font-bold text-cream">{stats.drafts} / {stats.sent}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Accepted</p>
          <p className="text-2xl font-bold text-green-400">{stats.accepted}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Proposal Value</p>
          <p className="text-2xl font-bold text-cream">{fmtMoney(stats.totalValue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-xl bg-smoke border border-line p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ember/15 border border-ember/30">
                <FileSignature className="h-5 w-5 text-ember" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-cream">{selectedId ? 'Edit Proposal' : 'Create Proposal'}</h2>
                <p className="text-xs text-mist/60">Start from a catering booking or enter event details manually.</p>
              </div>
            </div>
            <button type="button" onClick={resetForm} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
              Clear
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="booking_id" className={labelClass}>Start from booking</label>
              <select id="booking_id" className={inputClass} value={form.booking_id} onChange={event => applyBooking(event.target.value)}>
                <option value="">Manual proposal</option>
                {bookings.map(booking => (
                  <option key={booking.id} value={booking.id}>
                    {booking.client_name}{booking.event_date ? ` - ${fmtDate(booking.event_date)}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="proposal_number" className={labelClass}>Proposal number</label>
              <input id="proposal_number" className={inputClass} value={form.proposal_number} onChange={event => set('proposal_number', event.target.value)} />
            </div>
            <div>
              <label htmlFor="status" className={labelClass}>Status</label>
              <select id="status" className={inputClass} value={form.status} onChange={event => set('status', event.target.value as ProposalStatus)}>
                {statusOptions.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="client_name" className={labelClass}>Client name</label>
              <input id="client_name" className={inputClass} value={form.client_name} onChange={event => set('client_name', event.target.value)} placeholder="Smith Family Reunion" />
            </div>
            <div>
              <label htmlFor="client_email" className={labelClass}>Client email</label>
              <input id="client_email" type="email" className={inputClass} value={form.client_email} onChange={event => set('client_email', event.target.value)} placeholder="client@example.com" />
            </div>
            <div>
              <label htmlFor="client_phone" className={labelClass}>Phone</label>
              <input id="client_phone" className={inputClass} value={form.client_phone} onChange={event => set('client_phone', event.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label htmlFor="due_date" className={labelClass}>Proposal due date</label>
              <input id="due_date" type="date" className={inputClass} value={form.due_date} onChange={event => set('due_date', event.target.value)} />
            </div>
            <div>
              <label htmlFor="event_date" className={labelClass}>Event date</label>
              <input id="event_date" type="date" className={inputClass} value={form.event_date} onChange={event => set('event_date', event.target.value)} />
            </div>
            <div>
              <label htmlFor="event_time" className={labelClass}>Event time</label>
              <input id="event_time" className={inputClass} value={form.event_time} onChange={event => set('event_time', event.target.value)} placeholder="6:00 PM" />
            </div>
            <div>
              <label htmlFor="guest_count" className={labelClass}>Guest count</label>
              <input id="guest_count" type="number" min="1" className={inputClass} value={form.guest_count} onChange={event => set('guest_count', event.target.value)} />
            </div>
            <div>
              <label htmlFor="event_location" className={labelClass}>Event location</label>
              <input id="event_location" className={inputClass} value={form.event_location} onChange={event => set('event_location', event.target.value)} placeholder="Venue or full address" />
            </div>
            <div>
              <label htmlFor="total_amount" className={labelClass}>Total amount ($)</label>
              <input id="total_amount" type="number" min="0" step="0.01" className={inputClass} value={form.total_amount} onChange={event => set('total_amount', event.target.value)} />
            </div>
            <div>
              <label htmlFor="deposit_amount" className={labelClass}>Deposit amount ($)</label>
              <input id="deposit_amount" type="number" min="0" step="0.01" className={inputClass} value={form.deposit_amount} onChange={event => set('deposit_amount', event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="menu_summary" className={labelClass}>Menu and service summary</label>
              <textarea id="menu_summary" className={`${inputClass} min-h-[110px] resize-none`} value={form.menu_summary} onChange={event => set('menu_summary', event.target.value)} placeholder="Menu, service style, staffing, rentals, travel, or special requests..." />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="service_terms" className={labelClass}>Contract terms</label>
              <textarea id="service_terms" className={`${inputClass} min-h-[120px] resize-none`} value={form.service_terms} onChange={event => set('service_terms', event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="notes" className={labelClass}>Internal notes</label>
              <textarea id="notes" className={`${inputClass} min-h-[80px] resize-none`} value={form.notes} onChange={event => set('notes', event.target.value)} placeholder="Private notes not included in the downloaded proposal..." />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
            <button type="button" onClick={saveProposal} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Proposal
            </button>
            <button type="button" onClick={() => downloadProposal()} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
              <Download className="h-4 w-4" />
              Download Word
            </button>
            <button type="button" onClick={copyEmailDraft} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
              <Mail className="h-4 w-4" />
              Copy Email
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-ember" />
              <h2 className="text-sm font-semibold text-cream">Saved Proposals</h2>
            </div>
            <input className={`${inputClass} mb-4`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search proposals..." />

            {loading ? (
              <div className="flex justify-center py-10"><div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ember" /></div>
            ) : filtered.length === 0 ? (
              <p className="rounded-lg border border-line bg-coal px-3 py-6 text-center text-xs text-mist/60">No proposals found.</p>
            ) : (
              <div className="space-y-3">
                {filtered.slice(0, 10).map(proposal => (
                  <div key={proposal.id} className={`rounded-lg border bg-coal p-3 ${selectedId === proposal.id ? 'border-ember' : 'border-line'}`}>
                    <button type="button" onClick={() => loadProposal(proposal)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-cream">{proposal.client_name}</p>
                          <p className="text-xs text-mist">{proposal.proposal_number}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(proposal.status)}`}>
                          {proposal.status}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-mist/70">
                        <p className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" />{fmtDate(proposal.event_date)}</p>
                        <p className="flex items-center gap-1.5"><Users className="h-3 w-3" />{proposal.guest_count ?? 'TBD'} guests · {fmtMoney(proposal.total_amount)}</p>
                      </div>
                    </button>
                    <div className="mt-3 flex gap-2 border-t border-line pt-3">
                      <button type="button" onClick={() => downloadProposal(proposalToForm(proposal))} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
                        <Download className="h-3.5 w-3.5" /> Word
                      </button>
                      <button type="button" onClick={() => navigator.clipboard.writeText(proposal.client_email ?? '').then(() => setToast({ message: 'Client email copied.', type: 'success' }))} className="inline-flex items-center justify-center rounded-lg border border-line px-2 py-1.5 text-mist hover:bg-hover hover:text-cream transition-colors">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <OwnerOnly>
                        <button type="button" onClick={() => deleteProposal(proposal)} className="inline-flex items-center justify-center rounded-lg border border-line px-2 py-1.5 text-mist hover:bg-red-900/30 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </OwnerOnly>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-ember" />
              <h2 className="text-sm font-semibold text-cream">Workflow</h2>
            </div>
            <div className="space-y-3 text-xs leading-5 text-mist/70">
              <p>Create or load a catering booking, save the proposal, then download a Word-compatible contract for review.</p>
              <p>Use Copy Email to draft the message, attach the downloaded proposal, and update the proposal status after sending or acceptance.</p>
            </div>
          </div>
        </aside>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
    </ModuleGate>
  );
}
