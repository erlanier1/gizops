'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Modal } from '@/components/ui/modal';
import { withTimeout } from '@/lib/with-timeout';
import { Loader2, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

const DRAFT_KEY = 'gizops_draft_permit';

const PG_COUNTY_PERMITS = [
  { name: 'Mobile Food Facility Permit',  issuing_agency: "Prince George's County Health Dept" },
  { name: 'Food Service License',         issuing_agency: "Prince George's County Health Dept" },
  { name: 'Business License',             issuing_agency: "Prince George's County Clerk's Office" },
  { name: 'Fire Safety Certificate',      issuing_agency: "Prince George's County Fire Marshal" },
  { name: 'Commissary Kitchen Agreement', issuing_agency: 'Commissary Kitchen Provider' },
  { name: "Food Handler's Certification", issuing_agency: 'Maryland Department of Health' },
  { name: "Seller's Permit (Sales Tax)",  issuing_agency: "Maryland Comptroller's Office" },
  { name: "Vendor's License",             issuing_agency: "Maryland Comptroller's Office" },
];

export interface Permit {
  id?: string;
  name: string;
  issuing_agency: string;
  permit_number: string;
  issue_date: string;
  expiration_date: string;
  status: string;
  notes: string;
}

interface PermitModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  permit?: Permit | null;
}

const empty: Permit = {
  name: '', issuing_agency: '', permit_number: '',
  issue_date: '', expiration_date: '', status: 'active', notes: '',
};

export function PermitModal({ open, onClose, onSaved, permit }: PermitModalProps) {
  const supabase = createClientComponentClient();
  const [form, setForm] = useState<Permit>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const isEdit = !!permit?.id;

  // On open: restore draft (add mode only) or load permit for edit
  useEffect(() => {
    if (open) {
      setError(null);
      setShowChecklist(false);
      setDraftRestored(false);
      if (permit) {
        setForm({ ...permit });
      } else {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          try { setForm(JSON.parse(saved)); setDraftRestored(true); } catch { setForm(empty); }
        } else {
          setForm(empty);
        }
      }
    }
  }, [open, permit]);

  // Persist draft to localStorage while editing (add mode only)
  useEffect(() => {
    if (open && !isEdit) {
      const hasContent = Object.values(form).some(v => v !== '' && v !== 'active');
      if (hasContent) localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }
  }, [form, open, isEdit]);

  const set = (k: keyof Permit, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.expiration_date) { setError('Expiration date is required.'); return; }
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name,
      issuing_agency: form.issuing_agency || null,
      permit_number: form.permit_number || null,
      issue_date: form.issue_date || null,
      expiration_date: form.expiration_date,
      status: form.status,
      notes: form.notes || null,
    };

    try {
      const query = isEdit
        ? supabase.from('permits').update(payload).eq('id', permit!.id)
        : supabase.from('permits').insert(payload);
      const { error: dbErr } = await withTimeout(query as unknown as Promise<any>);
      if (dbErr) { setError(dbErr.message); setLoading(false); return; }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      return;
    }

    localStorage.removeItem(DRAFT_KEY);
    setLoading(false);
    onSaved(isEdit ? 'Permit updated' : 'Permit added');
    onClose();
  };

  const inp = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
  const lbl = 'block text-xs font-medium text-mist mb-1.5';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Permit' : 'Add Permit'}
      description="Track expiration dates and get alerts before permits lapse."
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

      {/* PG County checklist */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShowChecklist(v => !v)}
          className="flex items-center gap-1.5 text-xs text-ember hover:text-ember-light transition-colors"
        >
          {showChecklist ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          PG County permit checklist
        </button>
        {showChecklist && (
          <div className="mt-2 rounded-lg bg-coal border border-line divide-y divide-line overflow-hidden">
            {PG_COUNTY_PERMITS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => { set('name', p.name); set('issuing_agency', p.issuing_agency); setShowChecklist(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-hover transition-colors"
              >
                <p className="text-sm text-cream">{p.name}</p>
                <p className="text-xs text-mist">{p.issuing_agency}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={lbl}>Permit name *</label>
          <input required className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Mobile Food Facility Permit" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Issuing agency</label>
            <input className={inp} value={form.issuing_agency} onChange={e => set('issuing_agency', e.target.value)} placeholder="e.g. PG County Health Dept" />
          </div>
          <div>
            <label className={lbl}>Permit number</label>
            <input className={inp} value={form.permit_number} onChange={e => set('permit_number', e.target.value)} placeholder="e.g. MFF-2026-001" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Issue date</label>
            <input type="date" className={inp} value={form.issue_date} onChange={e => set('issue_date', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Expiration date *</label>
            <input type="date" required className={inp} value={form.expiration_date} onChange={e => set('expiration_date', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={lbl}>Status</label>
          <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div>
          <label className={lbl}>Notes</label>
          <textarea className={`${inp} resize-none`} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this permit..." />
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
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : (isEdit ? 'Save Changes' : 'Add Permit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
