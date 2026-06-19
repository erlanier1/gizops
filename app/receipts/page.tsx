'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileImage,
  Flag,
  Loader2,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Upload,
  WalletCards,
} from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PageHeader } from '@/components/page-header';
import { ManagerAndAbove, OwnerOnly } from '@/components/RoleGuard';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { useUser } from '@/lib/auth-context';
import { useAccountScope } from '@/lib/account-scope';

type ReceiptStatus = 'pending' | 'reviewed' | 'flagged';

type PurchaseReceipt = {
  id: string;
  account_id: string;
  vendor: string;
  purchase_date: string;
  total_amount: number;
  tax_amount: number | null;
  category: string;
  payment_method: string | null;
  notes: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  status: ReceiptStatus;
  reviewed_at: string | null;
  created_at: string;
};

type ReceiptForm = {
  vendor: string;
  purchase_date: string;
  total_amount: string;
  tax_amount: string;
  category: string;
  payment_method: string;
  notes: string;
};

const categories = [
  'Inventory',
  'Ingredients',
  'Packaging',
  'Equipment',
  'Fuel',
  'Repairs & Maintenance',
  'Permits & Fees',
  'Marketing',
  'Office',
  'Other',
];

const paymentMethods = ['Business card', 'Personal card', 'Cash', 'ACH / Bank', 'Check', 'Other'];

const emptyForm = (): ReceiptForm => ({
  vendor: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  total_amount: '',
  tax_amount: '',
  category: 'Inventory',
  payment_method: 'Business card',
  notes: '',
});

const inputClass = 'w-full rounded-lg border border-line bg-coal px-3 py-2.5 text-sm text-cream placeholder-mist/40 transition-colors focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember';
const labelClass = 'mb-1.5 block text-xs font-medium text-mist';

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function statusStyle(status: ReceiptStatus) {
  if (status === 'reviewed') return 'border-green-800 bg-green-900/30 text-green-400';
  if (status === 'flagged') return 'border-red-800 bg-red-900/30 text-red-400';
  return 'border-amber-800 bg-amber-900/30 text-amber-400';
}

function StatusIcon({ status }: { status: ReceiptStatus }) {
  if (status === 'reviewed') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'flagged') return <Flag className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
}

export default function ReceiptsPage() {
  const supabase = createClientComponentClient();
  const { user, profile, isSuperAdmin } = useUser();
  const { selectedAccountId } = useAccountScope();
  const accountId = isSuperAdmin ? selectedAccountId : profile?.account_id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ReceiptForm>(emptyForm);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReceiptStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchReceipts = useCallback(async () => {
    if (!accountId) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('purchase_receipts')
      .select('*')
      .eq('account_id', accountId)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setToast({ message: 'Receipts are not available until the database setup is run.', type: 'error' });
      setReceipts([]);
    } else {
      setReceipts((data as PurchaseReceipt[]) ?? []);
    }
    setLoading(false);
  }, [accountId, supabase]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const filtered = useMemo(() => receipts.filter(receipt => {
    const haystack = `${receipt.vendor} ${receipt.category} ${receipt.payment_method ?? ''} ${receipt.notes ?? ''}`.toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (statusFilter === 'all' || receipt.status === statusFilter)
      && (categoryFilter === 'all' || receipt.category === categoryFilter);
  }), [categoryFilter, query, receipts, statusFilter]);

  const stats = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    return {
      total: receipts.reduce((sum, receipt) => sum + Number(receipt.total_amount), 0),
      thisMonth: receipts
        .filter(receipt => receipt.purchase_date.startsWith(monthKey))
        .reduce((sum, receipt) => sum + Number(receipt.total_amount), 0),
      pending: receipts.filter(receipt => receipt.status === 'pending').length,
      flagged: receipts.filter(receipt => receipt.status === 'flagged').length,
    };
  }, [receipts]);

  const chooseFile = (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setToast({ message: 'Choose a JPG, PNG, WEBP, or PDF receipt.', type: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast({ message: 'Receipt files must be 10 MB or smaller.', type: 'error' });
      return;
    }
    setSelectedFile(file);
    setForm(emptyForm());
    setUploadOpen(true);
  };

  const closeUpload = () => {
    if (saving) return;
    setUploadOpen(false);
    setSelectedFile(null);
    setForm(emptyForm());
  };

  const handleUpload = async () => {
    const amount = Number.parseFloat(form.total_amount);
    const tax = form.tax_amount ? Number.parseFloat(form.tax_amount) : null;
    if (!selectedFile || !accountId || !user?.id) return;
    if (!form.vendor.trim() || !form.purchase_date || !Number.isFinite(amount) || amount < 0) {
      setToast({ message: 'Vendor, purchase date, and a valid total are required.', type: 'error' });
      return;
    }
    if (tax !== null && (!Number.isFinite(tax) || tax < 0)) {
      setToast({ message: 'Enter a valid tax amount or leave it blank.', type: 'error' });
      return;
    }

    setSaving(true);
    const extension = selectedFile.name.split('.').pop()?.toLowerCase() || 'file';
    const filePath = `${accountId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('purchase-receipts')
      .upload(filePath, selectedFile, { contentType: selectedFile.type, upsert: false });

    if (uploadError) {
      setSaving(false);
      setToast({ message: `Receipt upload failed: ${uploadError.message}`, type: 'error' });
      return;
    }

    const { data, error } = await supabase
      .from('purchase_receipts')
      .insert({
        account_id: accountId,
        vendor: form.vendor.trim(),
        purchase_date: form.purchase_date,
        total_amount: amount,
        tax_amount: tax,
        category: form.category,
        payment_method: form.payment_method || null,
        notes: form.notes.trim() || null,
        file_path: filePath,
        file_name: selectedFile.name,
        mime_type: selectedFile.type,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      await supabase.storage.from('purchase-receipts').remove([filePath]);
      setSaving(false);
      setToast({ message: `Receipt details could not be saved: ${error.message}`, type: 'error' });
      return;
    }

    setReceipts(previous => [data as PurchaseReceipt, ...previous]);
    setSaving(false);
    setUploadOpen(false);
    setSelectedFile(null);
    setForm(emptyForm());
    setToast({ message: 'Receipt saved and ready for review.', type: 'success' });
  };

  const openReceipt = async (receipt: PurchaseReceipt) => {
    setSelectedReceipt(receipt);
    setPreviewUrl(null);
    setDetailOpen(true);
    const { data, error } = await supabase.storage
      .from('purchase-receipts')
      .createSignedUrl(receipt.file_path, 300);
    if (error) {
      setToast({ message: 'The receipt file could not be opened.', type: 'error' });
      return;
    }
    setPreviewUrl(data.signedUrl);
  };

  const updateStatus = async (status: ReceiptStatus) => {
    if (!selectedReceipt) return;
    const reviewed = status === 'reviewed';
    const changes = {
      status,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      reviewed_by: reviewed ? user?.id ?? null : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('purchase_receipts')
      .update(changes)
      .eq('id', selectedReceipt.id);

    if (error) {
      setToast({ message: 'Receipt status could not be updated.', type: 'error' });
      return;
    }
    const updated = { ...selectedReceipt, ...changes };
    setSelectedReceipt(updated);
    setReceipts(previous => previous.map(receipt => receipt.id === updated.id ? updated : receipt));
    setToast({ message: status === 'reviewed' ? 'Receipt marked reviewed.' : 'Receipt flagged for follow-up.', type: 'success' });
  };

  const deleteReceipt = async (receipt: PurchaseReceipt) => {
    if (!window.confirm(`Delete the ${receipt.vendor} receipt for ${money(Number(receipt.total_amount))}?`)) return;
    const { error } = await supabase.from('purchase_receipts').delete().eq('id', receipt.id);
    if (error) {
      setToast({ message: 'The receipt record could not be deleted.', type: 'error' });
      return;
    }
    const { error: fileError } = await supabase.storage.from('purchase-receipts').remove([receipt.file_path]);
    setReceipts(previous => previous.filter(item => item.id !== receipt.id));
    setDetailOpen(false);
    setSelectedReceipt(null);
    setToast({
      message: fileError ? 'Receipt deleted, but its stored file needs cleanup.' : 'Receipt deleted.',
      type: fileError ? 'error' : 'success',
    });
  };

  return (
    <ModuleGate moduleKey="receipts">
      <div>
        <PageHeader
          title="Receipts"
          description="Store purchase receipts, track spending, and review expenses."
          action={
            <ManagerAndAbove>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!accountId}
                className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ember-dark disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add Receipt
              </button>
            </ManagerAndAbove>
          }
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) chooseFile(file);
            event.target.value = '';
          }}
        />

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-smoke p-4">
            <p className="mb-1 text-xs text-mist">All Purchases</p>
            <p className="text-2xl font-bold text-cream">{money(stats.total)}</p>
          </div>
          <div className="rounded-xl border border-line bg-smoke p-4">
            <p className="mb-1 text-xs text-mist">This Month</p>
            <p className="text-2xl font-bold text-cream">{money(stats.thisMonth)}</p>
          </div>
          <div className="rounded-xl border border-line bg-smoke p-4">
            <p className="mb-1 text-xs text-mist">Needs Review</p>
            <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-line bg-smoke p-4">
            <p className="mb-1 text-xs text-mist">Flagged</p>
            <p className="text-2xl font-bold text-red-400">{stats.flagged}</p>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist/40" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search vendor, category, payment method, or notes..."
              className="w-full rounded-lg border border-line bg-smoke py-2.5 pl-9 pr-4 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
            />
          </div>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | ReceiptStatus)} className={`${inputClass} lg:w-44`}>
            <option value="all">All statuses</option>
            <option value="pending">Needs review</option>
            <option value="reviewed">Reviewed</option>
            <option value="flagged">Flagged</option>
          </select>
          <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className={`${inputClass} lg:w-52`}>
            <option value="all">All categories</option>
            {categories.map(category => <option key={category}>{category}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-smoke">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <ReceiptText className="h-4 w-4 text-ember" />
            <h2 className="text-sm font-semibold text-cream">Purchase Receipts</h2>
            <span className="text-xs text-mist">({filtered.length})</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ember" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-hover">
                <FileImage className="h-7 w-7 text-mist/40" />
              </div>
              <p className="mb-2 text-sm font-semibold text-cream">
                {receipts.length === 0 ? 'No receipts stored yet' : 'No receipts match these filters'}
              </p>
              <p className="mb-6 max-w-sm text-xs leading-5 text-mist/60">
                {receipts.length === 0
                  ? 'Upload a photo or PDF after a purchase so the expense is easy to find and review later.'
                  : 'Try changing the search, status, or category filter.'}
              </p>
              {receipts.length === 0 && (
                <ManagerAndAbove>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark">
                    <Upload className="h-4 w-4" /> Upload First Receipt
                  </button>
                </ManagerAndAbove>
              )}
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filtered.map(receipt => (
                <button
                  key={receipt.id}
                  onClick={() => openReceipt(receipt)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-hover/30 md:grid-cols-[auto_minmax(0,1fr)_150px_120px_auto]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-hover">
                    <ReceiptText className="h-5 w-5 text-ember" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-cream">{receipt.vendor}</p>
                    <p className="mt-0.5 truncate text-xs text-mist">{receipt.category} · {receipt.file_name}</p>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-semibold text-cream">{money(Number(receipt.total_amount))}</p>
                    <p className="mt-0.5 text-xs text-mist">{dateLabel(receipt.purchase_date)}</p>
                  </div>
                  <span className={`hidden w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize md:inline-flex ${statusStyle(receipt.status)}`}>
                    <StatusIcon status={receipt.status} />
                    {receipt.status === 'pending' ? 'Needs review' : receipt.status}
                  </span>
                  <div className="text-right md:hidden">
                    <p className="text-sm font-semibold text-cream">{money(Number(receipt.total_amount))}</p>
                    <p className={`mt-1 text-[10px] capitalize ${receipt.status === 'flagged' ? 'text-red-400' : receipt.status === 'reviewed' ? 'text-green-400' : 'text-amber-400'}`}>
                      {receipt.status === 'pending' ? 'Needs review' : receipt.status}
                    </p>
                  </div>
                  <Eye className="hidden h-4 w-4 text-mist/50 md:block" />
                </button>
              ))}
            </div>
          )}
        </div>

        <Modal open={uploadOpen} onClose={closeUpload} title="Add Purchase Receipt" description={selectedFile?.name}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-hover px-4 py-3">
              <FileImage className="h-5 w-5 shrink-0 text-ember" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-cream">{selectedFile?.name}</p>
                <p className="text-xs text-mist">{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : ''}</p>
              </div>
            </div>
            <div>
              <label className={labelClass}>Vendor *</label>
              <input value={form.vendor} onChange={event => setForm(previous => ({ ...previous, vendor: event.target.value }))} className={inputClass} placeholder="Restaurant Depot" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Purchase date *</label>
                <input type="date" value={form.purchase_date} onChange={event => setForm(previous => ({ ...previous, purchase_date: event.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Total *</label>
                <input type="number" min="0" step="0.01" value={form.total_amount} onChange={event => setForm(previous => ({ ...previous, total_amount: event.target.value }))} className={inputClass} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Category</label>
                <select value={form.category} onChange={event => setForm(previous => ({ ...previous, category: event.target.value }))} className={inputClass}>
                  {categories.map(category => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tax</label>
                <input type="number" min="0" step="0.01" value={form.tax_amount} onChange={event => setForm(previous => ({ ...previous, tax_amount: event.target.value }))} className={inputClass} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Payment method</label>
              <select value={form.payment_method} onChange={event => setForm(previous => ({ ...previous, payment_method: event.target.value }))} className={inputClass}>
                {paymentMethods.map(method => <option key={method}>{method}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea value={form.notes} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} className={`${inputClass} min-h-[88px] resize-none`} placeholder="What was purchased, project or event, reimbursement details..." />
            </div>
            <div className="flex justify-end gap-3 border-t border-line pt-4">
              <button onClick={closeUpload} disabled={saving} className="rounded-lg border border-line px-4 py-2 text-sm text-mist hover:bg-hover hover:text-cream">Cancel</button>
              <button onClick={handleUpload} disabled={saving} className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Receipt'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={selectedReceipt?.vendor ?? 'Receipt'} description={selectedReceipt ? `${dateLabel(selectedReceipt.purchase_date)} · ${money(Number(selectedReceipt.total_amount))}` : undefined} className="max-w-3xl">
          {selectedReceipt && (
            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-xl border border-line bg-coal">
                  {!previewUrl ? (
                    <Loader2 className="h-6 w-6 animate-spin text-ember" />
                  ) : selectedReceipt.mime_type === 'application/pdf' ? (
                    <iframe src={previewUrl} title={`${selectedReceipt.vendor} receipt`} className="h-[520px] w-full" />
                  ) : (
                    <img src={previewUrl} alt={`${selectedReceipt.vendor} receipt`} className="max-h-[520px] w-full object-contain" />
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-mist">Amount</p>
                    <p className="mt-1 text-2xl font-bold text-cream">{money(Number(selectedReceipt.total_amount))}</p>
                    {selectedReceipt.tax_amount != null && <p className="mt-1 text-xs text-mist">Includes {money(Number(selectedReceipt.tax_amount))} tax</p>}
                  </div>
                  <div className="space-y-3 rounded-xl border border-line bg-coal p-4 text-sm">
                    <p className="flex items-center gap-2 text-cream"><CalendarDays className="h-4 w-4 text-mist" /> {dateLabel(selectedReceipt.purchase_date)}</p>
                    <p className="flex items-center gap-2 text-cream"><ReceiptText className="h-4 w-4 text-mist" /> {selectedReceipt.category}</p>
                    <p className="flex items-center gap-2 text-cream"><WalletCards className="h-4 w-4 text-mist" /> {selectedReceipt.payment_method || 'Not recorded'}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${statusStyle(selectedReceipt.status)}`}>
                    <StatusIcon status={selectedReceipt.status} />
                    {selectedReceipt.status === 'pending' ? 'Needs review' : selectedReceipt.status}
                  </span>
                  {selectedReceipt.notes && (
                    <div>
                      <p className="text-xs font-medium text-mist">Notes</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-cream">{selectedReceipt.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <div className="flex flex-wrap gap-2">
                  <ManagerAndAbove>
                    <button onClick={() => updateStatus('reviewed')} className="flex items-center gap-2 rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-600">
                      <CheckCircle2 className="h-4 w-4" /> Mark Reviewed
                    </button>
                    <button onClick={() => updateStatus('flagged')} className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/30 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-900/40">
                      <Flag className="h-4 w-4" /> Flag
                    </button>
                  </ManagerAndAbove>
                </div>
                <div className="flex gap-2">
                  {previewUrl && (
                    <a href={previewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-mist hover:bg-hover hover:text-cream">
                      <Download className="h-4 w-4" /> Open File
                    </a>
                  )}
                  <OwnerOnly>
                    <button onClick={() => deleteReceipt(selectedReceipt)} className="flex items-center gap-2 rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 hover:bg-red-950/40">
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </OwnerOnly>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </div>
    </ModuleGate>
  );
}
