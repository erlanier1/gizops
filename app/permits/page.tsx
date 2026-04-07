'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { PageHeader } from '@/components/page-header';
import { PermitModal, type Permit } from '@/components/permits/permit-modal';
import { Toast } from '@/components/ui/toast';
import { ManagerAndAbove, OwnerOnly } from '@/components/RoleGuard';
import { FileText, Plus, Pencil, Trash2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface DBPermit extends Permit {
  id: string;
  reminder_sent: boolean;
  created_at: string;
}

function daysLeft(exp: string | null): number | null {
  if (!exp) return null;
  return Math.floor((new Date(exp).getTime() - Date.now()) / 86_400_000);
}

function statusFromDays(d: number | null): 'active' | 'expiring_soon' | 'expired' {
  if (d === null) return 'active';
  if (d < 0) return 'expired';
  if (d <= 60) return 'expiring_soon';
  return 'active';
}

function StatusBadge({ days }: { days: number | null }) {
  const s = statusFromDays(days);
  if (s === 'expired')
    return <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-red-900/30 border-red-800 text-red-400 font-medium"><AlertCircle className="h-3 w-3" />Expired</span>;
  if (s === 'expiring_soon')
    return <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-amber-900/30 border-amber-800 text-amber-400 font-medium"><Clock className="h-3 w-3" />{days}d left</span>;
  return <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-green-900/30 border-green-800 text-green-400 font-medium"><CheckCircle2 className="h-3 w-3" />Active</span>;
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ember" /></div>;
}

export default function PermitsPage() {
  const supabase = createClientComponentClient();
  const [permits, setPermits] = useState<DBPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DBPermit | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('permits').select('*').order('expiration_date', { ascending: true });
    setPermits((data as DBPermit[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: DBPermit) => { setEditing(p); setModalOpen(true); };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this permit? This cannot be undone.')) return;
    const { error } = await supabase.from('permits').delete().eq('id', id);
    if (error) { setToast({ message: 'Failed to delete permit.', type: 'error' }); return; }
    setToast({ message: 'Permit deleted.', type: 'success' });
    fetch();
  };

  const handleSaved = (msg: string) => { setToast({ message: msg, type: 'success' }); fetch(); };

  const counts = {
    active:   permits.filter(p => statusFromDays(daysLeft(p.expiration_date)) === 'active').length,
    expiring: permits.filter(p => statusFromDays(daysLeft(p.expiration_date)) === 'expiring_soon').length,
    expired:  permits.filter(p => statusFromDays(daysLeft(p.expiration_date)) === 'expired').length,
  };

  return (
    <div>
      <PageHeader
        title="Permits & Licenses"
        description="Track all regulatory permits, licenses, and compliance documents."
        action={
          <ManagerAndAbove>
            <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors">
              <Plus className="h-4 w-4" /> Add Permit
            </button>
          </ManagerAndAbove>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl bg-smoke border border-line p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{counts.active}</p>
          <p className="text-xs text-mist mt-1">Active</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{counts.expiring}</p>
          <p className="text-xs text-mist mt-1">Expiring Soon</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{counts.expired}</p>
          <p className="text-xs text-mist mt-1">Expired</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-smoke border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <FileText className="h-4 w-4 text-ember" />
          <h2 className="text-sm font-semibold text-cream">All Permits & Licenses</h2>
          <span className="text-xs text-mist font-normal">({permits.length})</span>
        </div>

        {loading ? <Spinner /> : permits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
              <FileText className="h-7 w-7 text-mist/40" />
            </div>
            <p className="text-sm font-semibold text-cream mb-2">No permits added yet</p>
            <p className="text-xs text-mist/50 mb-6 max-w-xs">Add your first permit to start tracking expiration dates and get alerts before they lapse.</p>
            <ManagerAndAbove>
              <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors">
                <Plus className="h-4 w-4" /> Add Permit
              </button>
            </ManagerAndAbove>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {permits.map(permit => {
              const days = daysLeft(permit.expiration_date);
              return (
                <div key={permit.id} className="flex items-center gap-4 px-5 py-4 hover:bg-hover/30 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-hover shrink-0">
                    <FileText className="h-5 w-5 text-mist/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cream">{permit.name}</p>
                    <p className="text-xs text-mist mt-0.5">
                      {permit.issuing_agency ?? '—'}
                      {permit.permit_number ? ` · #${permit.permit_number}` : ''}
                    </p>
                  </div>
                  <div className="text-right hidden md:block shrink-0">
                    <p className="text-xs text-mist">Expires</p>
                    <p className="text-sm text-cream">
                      {permit.expiration_date
                        ? new Date(permit.expiration_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                  <div className="shrink-0"><StatusBadge days={days} /></div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ManagerAndAbove>
                      <button onClick={() => openEdit(permit)} className="p-1.5 rounded-lg text-mist hover:bg-hover hover:text-cream transition-colors" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </ManagerAndAbove>
                    <OwnerOnly>
                      <button onClick={() => handleDelete(permit.id)} className="p-1.5 rounded-lg text-mist hover:bg-red-900/30 hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </OwnerOnly>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PermitModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={handleSaved} permit={editing} />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
