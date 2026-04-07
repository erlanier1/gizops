'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { PageHeader } from '@/components/page-header';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { ManagerAndAbove, OwnerOnly } from '@/components/RoleGuard';
import { useUser } from '@/lib/auth-context';
import { FolderOpen, Upload, FileText, File, Plus, Search, Download, Loader2, X, Trash2 } from 'lucide-react';

type Category = 'insurance' | 'permit' | 'commissary' | 'license' | 'certification' | 'contract' | 'other';

interface Doc {
  id: string;
  name: string;
  category: Category;
  file_url: string;
  file_name: string;
  expiration_date: string | null;
  notes: string | null;
  created_at: string;
}

const CATS: { value: Category; label: string }[] = [
  { value: 'insurance',     label: 'Insurance' },
  { value: 'permit',        label: 'Permit' },
  { value: 'commissary',    label: 'Commissary' },
  { value: 'license',       label: 'License' },
  { value: 'certification', label: 'Certification' },
  { value: 'contract',      label: 'Contract' },
  { value: 'other',         label: 'Other' },
];

const CAT_COLOR: Record<Category, string> = {
  insurance:     'bg-red-900/30 text-red-400 border-red-800',
  permit:        'bg-amber-900/30 text-amber-400 border-amber-800',
  commissary:    'bg-green-900/30 text-green-400 border-green-800',
  license:       'bg-blue-900/30 text-blue-400 border-blue-800',
  certification: 'bg-purple-900/30 text-purple-400 border-purple-800',
  contract:      'bg-ember/20 text-ember border-ember/40',
  other:         'bg-hover text-mist border-line',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DocumentsPage() {
  const supabase = createClientComponentClient();
  const { canEdit } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<Category | 'all'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [form, setForm] = useState({ name: '', category: 'other' as Category, expiration_date: '', notes: '' });

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const pickFile = (file: File) => {
    setSelectedFile(file);
    setForm(f => ({ ...f, name: file.name.replace(/\.[^/.]+$/, '') }));
    setUploadOpen(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) pickFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !form.name) return;
    setUploading(true);

    const ext = selectedFile.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: storageErr } = await supabase.storage.from('business-docs').upload(path, selectedFile);
    if (storageErr) {
      setToast({ message: `Upload failed: ${storageErr.message}`, type: 'error' });
      setUploading(false);
      return;
    }

    const { error: dbErr } = await supabase.from('documents').insert({
      name: form.name,
      category: form.category,
      file_url: path,
      file_name: selectedFile.name,
      expiration_date: form.expiration_date || null,
      notes: form.notes || null,
    });

    setUploading(false);
    if (dbErr) { setToast({ message: `Save failed: ${dbErr.message}`, type: 'error' }); return; }

    setToast({ message: 'Document uploaded', type: 'success' });
    setUploadOpen(false);
    setSelectedFile(null);
    setForm({ name: '', category: 'other', expiration_date: '', notes: '' });
    fetchDocs();
  };

  const handleDownload = async (doc: Doc) => {
    const { data, error } = await supabase.storage.from('business-docs').createSignedUrl(doc.file_url, 60);
    if (error || !data?.signedUrl) { setToast({ message: 'Could not generate download link.', type: 'error' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const handleDelete = async (doc: Doc) => {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    const { error: storageErr } = await supabase.storage.from('business-docs').remove([doc.file_url]);
    if (storageErr) { setToast({ message: 'Failed to delete file.', type: 'error' }); return; }
    const { error: dbErr } = await supabase.from('documents').delete().eq('id', doc.id);
    if (dbErr) { setToast({ message: 'Failed to delete record.', type: 'error' }); return; }
    setToast({ message: 'Document deleted.', type: 'success' });
    fetchDocs();
  };

  const filtered = docs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) &&
    (activeCat === 'all' || d.category === activeCat)
  );

  const countCat = (c: Category) => docs.filter(d => d.category === c).length;

  const inp = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
  const lbl = 'block text-xs font-medium text-mist mb-1.5';

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Store and manage permits, contracts, menus, and operational files."
        action={
          <ManagerAndAbove>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors">
              <Plus className="h-4 w-4" /> Upload
            </button>
          </ManagerAndAbove>
        }
      />

      <input ref={fileInputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }} />

      {/* Drop zone — visible to managers+ only */}
      <ManagerAndAbove>
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-8 mb-6 text-center cursor-pointer transition-all ${
            dragOver ? 'border-ember bg-ember/10' : 'border-line bg-smoke hover:border-mist/30 hover:bg-hover/30'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-hover mx-auto mb-3">
            <Upload className={`h-5 w-5 ${dragOver ? 'text-ember' : 'text-mist/60'}`} />
          </div>
          <p className="text-sm font-medium text-cream">Drop a file here or click to browse</p>
          <p className="text-xs text-mist mt-1">PDF, DOCX, PNG, JPG — any file type accepted</p>
        </div>
      </ManagerAndAbove>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-mist/40" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg bg-smoke border border-line pl-9 pr-4 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveCat('all')}
            className={`rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${activeCat === 'all' ? 'bg-ember border-ember text-white' : 'bg-smoke border-line text-mist hover:border-mist/30 hover:text-cream'}`}
          >
            All ({docs.length})
          </button>
          {CATS.filter(c => countCat(c.value) > 0).map(c => (
            <button
              key={c.value}
              onClick={() => setActiveCat(c.value)}
              className={`rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${activeCat === c.value ? 'bg-ember border-ember text-white' : 'bg-smoke border-line text-mist hover:border-mist/30 hover:text-cream'}`}
            >
              {c.label} ({countCat(c.value)})
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div className="rounded-xl bg-smoke border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-ember" />
          <h2 className="text-sm font-semibold text-cream">All Documents</h2>
          <span className="text-xs text-mist">({filtered.length} files)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ember" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
              <Upload className="h-7 w-7 text-mist/40" />
            </div>
            <p className="text-sm font-semibold text-cream mb-2">
              {docs.length === 0 ? 'No documents uploaded' : 'No documents match your search'}
            </p>
            <p className="text-xs text-mist/50 mb-6 max-w-xs">
              {docs.length === 0
                ? 'Upload your first compliance document, permit, contract, or menu to keep everything in one place.'
                : 'Try a different search term or category.'}
            </p>
            {docs.length === 0 && (
              <ManagerAndAbove>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors">
                  <Upload className="h-4 w-4" /> Upload Document
                </button>
              </ManagerAndAbove>
            )}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filtered.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-hover/30 transition-colors group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-hover shrink-0">
                  <FileText className="h-4 w-4 text-mist/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-cream truncate">{doc.name}</p>
                  <p className="text-xs text-mist mt-0.5">
                    {doc.file_name}
                    {doc.expiration_date ? ` · Expires ${fmtDate(doc.expiration_date)}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium hidden sm:inline-flex ${CAT_COLOR[doc.category]}`}>
                  {CATS.find(c => c.value === doc.category)?.label ?? doc.category}
                </span>
                <p className="text-xs text-mist hidden lg:block shrink-0">{fmtDate(doc.created_at)}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 rounded-lg text-mist hover:bg-hover hover:text-cream transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <OwnerOnly>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-1.5 rounded-lg text-mist hover:bg-red-900/30 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </OwnerOnly>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      <Modal
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); setSelectedFile(null); }}
        title="Upload Document"
        description={selectedFile ? `File: ${selectedFile.name}` : undefined}
      >
        {selectedFile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-hover border border-line px-4 py-3">
              <File className="h-5 w-5 text-ember shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-cream truncate">{selectedFile.name}</p>
                <p className="text-xs text-mist">{(selectedFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={() => { setUploadOpen(false); setSelectedFile(null); }} className="text-mist hover:text-cream transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className={lbl}>Document name *</label>
              <input required className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Health Inspection Certificate 2026" />
            </div>
            <div>
              <label className={lbl}>Category</label>
              <select className={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Expiration date (optional)</label>
              <input type="date" className={inp} value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <textarea className={`${inp} resize-none`} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this document..." />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setUploadOpen(false); setSelectedFile(null); }} className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
                Cancel
              </button>
              <button onClick={handleUpload} disabled={uploading || !form.name} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-ember-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Upload</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
