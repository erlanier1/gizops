'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { ManagerAndAbove, OwnerOnly } from '@/components/RoleGuard';
import { ModuleGate } from '@/components/ModuleGate';

type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired';

type InventoryItem = {
  id: string;
  item_name: string;
  category: string;
  unit: string;
  quantity_on_hand: number;
  par_level: number;
  reorder_quantity: number;
  vendor: string | null;
  storage_location: string | null;
  expiration_date: string | null;
  cost_per_unit: number | null;
  sku: string | null;
  notes: string | null;
  updated_at?: string | null;
};

type InventoryForm = {
  item_name: string;
  category: string;
  unit: string;
  quantity_on_hand: string;
  par_level: string;
  reorder_quantity: string;
  vendor: string;
  storage_location: string;
  expiration_date: string;
  cost_per_unit: string;
  sku: string;
  notes: string;
};

const STORAGE_KEY = 'gizops.inventory.local';

const categories = [
  'All Categories',
  'Protein',
  'Produce',
  'Dry Goods',
  'Dairy',
  'Beverage',
  'Packaging',
  'Cleaning',
  'Equipment',
];

const units = ['lb', 'oz', 'case', 'each', 'gal', 'qt', 'tray', 'bag', 'box'];

const emptyForm: InventoryForm = {
  item_name: '',
  category: 'Dry Goods',
  unit: 'each',
  quantity_on_hand: '0',
  par_level: '0',
  reorder_quantity: '0',
  vendor: '',
  storage_location: '',
  expiration_date: '',
  cost_per_unit: '',
  sku: '',
  notes: '',
};

const seedItems: InventoryItem[] = [
  {
    id: 'local-chicken-breast',
    item_name: 'Chicken Breast',
    category: 'Protein',
    unit: 'lb',
    quantity_on_hand: 18,
    par_level: 25,
    reorder_quantity: 40,
    vendor: 'Restaurant Depot',
    storage_location: 'Walk-in freezer',
    expiration_date: '',
    cost_per_unit: 3.25,
    sku: 'PRO-CHX-001',
    notes: 'Primary protein for weekly meal prep bowls.',
  },
  {
    id: 'local-rice',
    item_name: 'Jasmine Rice',
    category: 'Dry Goods',
    unit: 'bag',
    quantity_on_hand: 8,
    par_level: 6,
    reorder_quantity: 10,
    vendor: 'US Foods',
    storage_location: 'Dry storage',
    expiration_date: '',
    cost_per_unit: 18,
    sku: 'DRY-RIC-002',
    notes: '',
  },
  {
    id: 'local-containers',
    item_name: '32 oz Meal Prep Containers',
    category: 'Packaging',
    unit: 'case',
    quantity_on_hand: 2,
    par_level: 5,
    reorder_quantity: 8,
    vendor: 'Webstaurant',
    storage_location: 'Packaging shelf',
    expiration_date: '',
    cost_per_unit: 42,
    sku: 'PKG-32OZ-003',
    notes: 'Reorder before daycare meal prep production days.',
  },
];

const inputClass = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
const labelClass = 'block text-xs font-medium text-mist mb-1.5';

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fmtMoney(value: number | null) {
  if (value == null) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function daysUntil(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000);
}

function statusFor(item: InventoryItem): InventoryStatus {
  const days = daysUntil(item.expiration_date);
  if (days !== null && days < 0) return 'expired';
  if (days !== null && days <= 7) return 'expiring_soon';
  if (item.quantity_on_hand <= 0) return 'out_of_stock';
  if (item.quantity_on_hand <= item.par_level) return 'low_stock';
  return 'in_stock';
}

function statusLabel(status: InventoryStatus) {
  const labels: Record<InventoryStatus, string> = {
    in_stock: 'In Stock',
    low_stock: 'Low Stock',
    out_of_stock: 'Out',
    expiring_soon: 'Expiring',
    expired: 'Expired',
  };
  return labels[status];
}

function StatusBadge({ item }: { item: InventoryItem }) {
  const status = statusFor(item);
  const styles: Record<InventoryStatus, string> = {
    in_stock: 'bg-green-900/30 border-green-800 text-green-400',
    low_stock: 'bg-amber-900/30 border-amber-800 text-amber-400',
    out_of_stock: 'bg-red-900/30 border-red-800 text-red-400',
    expiring_soon: 'bg-amber-900/30 border-amber-800 text-amber-400',
    expired: 'bg-red-900/30 border-red-800 text-red-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {status === 'in_stock' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {statusLabel(status)}
    </span>
  );
}

function itemToForm(item: InventoryItem): InventoryForm {
  return {
    item_name: item.item_name,
    category: item.category,
    unit: item.unit,
    quantity_on_hand: item.quantity_on_hand.toString(),
    par_level: item.par_level.toString(),
    reorder_quantity: item.reorder_quantity.toString(),
    vendor: item.vendor ?? '',
    storage_location: item.storage_location ?? '',
    expiration_date: item.expiration_date ?? '',
    cost_per_unit: item.cost_per_unit?.toString() ?? '',
    sku: item.sku ?? '',
    notes: item.notes ?? '',
  };
}

function formToPayload(form: InventoryForm) {
  return {
    item_name: form.item_name.trim(),
    category: form.category,
    unit: form.unit,
    quantity_on_hand: toNumber(form.quantity_on_hand),
    par_level: toNumber(form.par_level),
    reorder_quantity: toNumber(form.reorder_quantity),
    vendor: form.vendor.trim() || null,
    storage_location: form.storage_location.trim() || null,
    expiration_date: form.expiration_date || null,
    cost_per_unit: form.cost_per_unit ? toNumber(form.cost_per_unit) : null,
    sku: form.sku.trim() || null,
    notes: form.notes.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ember" /></div>;
}

export default function InventoryPage() {
  const supabase = createClientComponentClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usesLocalStorage, setUsesLocalStorage] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const saveLocal = useCallback((nextItems: InventoryItem[]) => {
    setItems(nextItems);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  }, []);

  const loadLocal = useCallback(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const localItems = stored ? JSON.parse(stored) as InventoryItem[] : seedItems;
    saveLocal(localItems);
    setUsesLocalStorage(true);
  }, [saveLocal]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('item_name', { ascending: true });

    if (error) {
      loadLocal();
      setLoading(false);
      return;
    }

    setUsesLocalStorage(false);
    setItems((data as InventoryItem[]) ?? []);
    setLoading(false);
  }, [loadLocal, supabase]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const text = `${item.item_name} ${item.category} ${item.vendor ?? ''} ${item.storage_location ?? ''} ${item.sku ?? ''}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesCategory = category === 'All Categories' || item.category === category;
      const status = statusFor(item);
      const matchesStatus = statusFilter === 'all'
        || statusFilter === status
        || (statusFilter === 'needs_attention' && status !== 'in_stock');
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [category, items, query, statusFilter]);

  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, item) => sum + item.quantity_on_hand * (item.cost_per_unit ?? 0), 0);
    const lowStock = items.filter(item => ['low_stock', 'out_of_stock'].includes(statusFor(item))).length;
    const expiring = items.filter(item => ['expiring_soon', 'expired'].includes(statusFor(item))).length;
    return {
      total: items.length,
      lowStock,
      expiring,
      totalValue,
    };
  }, [items]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm(itemToForm(item));
    setModalOpen(true);
  };

  const persistLocalItem = (payload: Omit<InventoryItem, 'id'>, id?: string) => {
    const nextItem: InventoryItem = { id: id ?? crypto.randomUUID(), ...payload };
    const nextItems = id
      ? items.map(item => item.id === id ? nextItem : item)
      : [...items, nextItem].sort((a, b) => a.item_name.localeCompare(b.item_name));
    saveLocal(nextItems);
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) {
      setToast({ message: 'Item name is required.', type: 'error' });
      return;
    }

    const payload = formToPayload(form);

    if (usesLocalStorage) {
      persistLocalItem(payload, editing?.id);
      setToast({ message: editing ? 'Inventory item updated locally.' : 'Inventory item added locally.', type: 'success' });
      setModalOpen(false);
      return;
    }

    const request = editing
      ? supabase.from('inventory_items').update(payload).eq('id', editing.id).select().single()
      : supabase.from('inventory_items').insert(payload).select().single();

    const { data, error } = await request;
    if (error) {
      persistLocalItem(payload, editing?.id);
      setUsesLocalStorage(true);
      setToast({ message: 'Database save failed, so this item was saved locally.', type: 'error' });
    } else if (editing) {
      setItems(prev => prev.map(item => item.id === editing.id ? data as InventoryItem : item));
      setToast({ message: 'Inventory item updated.', type: 'success' });
    } else {
      setItems(prev => [...prev, data as InventoryItem].sort((a, b) => a.item_name.localeCompare(b.item_name)));
      setToast({ message: 'Inventory item added.', type: 'success' });
    }

    setModalOpen(false);
  };

  const adjustQuantity = async (item: InventoryItem, delta: number) => {
    const nextQuantity = Math.max(0, item.quantity_on_hand + delta);
    const nextItem = { ...item, quantity_on_hand: nextQuantity, updated_at: new Date().toISOString() };

    if (usesLocalStorage) {
      saveLocal(items.map(current => current.id === item.id ? nextItem : current));
      return;
    }

    const { error } = await supabase
      .from('inventory_items')
      .update({ quantity_on_hand: nextQuantity, updated_at: nextItem.updated_at })
      .eq('id', item.id);

    if (error) {
      setUsesLocalStorage(true);
      saveLocal(items.map(current => current.id === item.id ? nextItem : current));
      setToast({ message: 'Database update failed, so the count was updated locally.', type: 'error' });
      return;
    }

    setItems(prev => prev.map(current => current.id === item.id ? nextItem : current));
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!window.confirm(`Delete "${item.item_name}" from inventory? This cannot be undone.`)) return;

    if (usesLocalStorage) {
      saveLocal(items.filter(current => current.id !== item.id));
      setToast({ message: 'Inventory item deleted locally.', type: 'success' });
      return;
    }

    const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
    if (error) {
      setToast({ message: 'Failed to delete inventory item.', type: 'error' });
      return;
    }
    setItems(prev => prev.filter(current => current.id !== item.id));
    setToast({ message: 'Inventory item deleted.', type: 'success' });
  };

  return (
    <ModuleGate moduleKey="inventory">
    <div>
      <PageHeader
        title="Inventory"
        description="Track stock levels, ingredients, supplies, low-stock alerts, and restock needs."
        action={
          <ManagerAndAbove>
            <button onClick={openAdd} className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </ManagerAndAbove>
        }
      />

      {usesLocalStorage && (
        <div className="mb-5 rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-xs leading-5 text-amber-200">
          Inventory is running in local mode because the `inventory_items` database table is not available yet. You can still test the workflow here; connect the table later for team-wide persistence.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Tracked Items</p>
          <p className="text-2xl font-bold text-cream">{stats.total}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Low / Out</p>
          <p className="text-2xl font-bold text-amber-400">{stats.lowStock}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Expiring</p>
          <p className="text-2xl font-bold text-red-400">{stats.expiring}</p>
        </div>
        <div className="rounded-xl bg-smoke border border-line p-4">
          <p className="text-xs text-mist mb-1">Estimated Value</p>
          <p className="text-2xl font-bold text-cream">{fmtMoney(stats.totalValue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-6">
        <section className="rounded-xl bg-smoke border border-line overflow-hidden">
          <div className="border-b border-line p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist/50" />
                <input
                  className={`${inputClass} pl-9`}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search item, vendor, SKU, location..."
                />
              </div>
              <select className={inputClass} value={category} onChange={event => setCategory(event.target.value)}>
                {categories.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className={inputClass} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="all">All Statuses</option>
                <option value="needs_attention">Needs Attention</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="expiring_soon">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {loading ? <Spinner /> : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
                <Package className="h-7 w-7 text-mist/40" />
              </div>
              <p className="text-sm font-semibold text-cream">No inventory items found</p>
              <p className="mt-1 max-w-sm text-xs text-mist/50">Add supplies or clear the filters to see current stock levels.</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filteredItems.map(item => {
                const days = daysUntil(item.expiration_date);
                const reorderNeeded = item.quantity_on_hand <= item.par_level;
                return (
                  <div key={item.id} className="grid gap-4 px-5 py-4 hover:bg-hover/30 transition-colors lg:grid-cols-[minmax(0,1.35fr)_180px_170px_120px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-cream">{item.item_name}</p>
                        <StatusBadge item={item} />
                      </div>
                      <p className="mt-1 text-xs text-mist">
                        {item.category}
                        {item.sku ? ` · ${item.sku}` : ''}
                        {item.vendor ? ` · ${item.vendor}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist/70">
                        <span className="inline-flex items-center gap-1.5"><Warehouse className="h-3 w-3" />{item.storage_location || 'No location'}</span>
                        <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3 w-3" />{item.expiration_date ? `${item.expiration_date}${days !== null ? ` (${days}d)` : ''}` : 'No expiration'}</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-mist/50">On hand</p>
                      <div className="mt-1 flex items-center gap-2">
                        <ManagerAndAbove>
                          <button onClick={() => adjustQuantity(item, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-mist hover:bg-hover hover:text-cream">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        </ManagerAndAbove>
                        <p className="min-w-16 text-center text-lg font-bold text-cream">{item.quantity_on_hand} <span className="text-xs font-normal text-mist">{item.unit}</span></p>
                        <ManagerAndAbove>
                          <button onClick={() => adjustQuantity(item, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-mist hover:bg-hover hover:text-cream">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </ManagerAndAbove>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-mist/50">Par / reorder</p>
                      <p className="mt-1 text-sm text-cream">
                        {item.par_level} {item.unit}
                        <span className={reorderNeeded ? 'ml-2 text-xs font-semibold text-amber-400' : 'ml-2 text-xs text-mist'}>{reorderNeeded ? `Order ${item.reorder_quantity}` : 'OK'}</span>
                      </p>
                      <p className="mt-1 text-xs text-mist/70">{fmtMoney(item.cost_per_unit)} per {item.unit}</p>
                    </div>

                    <div className="flex items-center justify-start gap-1 lg:justify-end">
                      <ManagerAndAbove>
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-mist hover:bg-hover hover:text-cream transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </ManagerAndAbove>
                      <OwnerOnly>
                        <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg text-mist hover:bg-red-900/30 hover:text-red-400 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </OwnerOnly>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-ember" />
              <h2 className="text-sm font-semibold text-cream">Restock Queue</h2>
            </div>
            <div className="space-y-3">
              {items.filter(item => item.quantity_on_hand <= item.par_level).slice(0, 6).map(item => (
                <div key={item.id} className="rounded-lg border border-line bg-coal px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-cream">{item.item_name}</p>
                    <p className="text-xs font-semibold text-amber-400">Order {item.reorder_quantity}</p>
                  </div>
                  <p className="mt-1 text-xs text-mist">{item.quantity_on_hand} on hand · par {item.par_level} · {item.vendor || 'No vendor'}</p>
                </div>
              ))}
              {items.filter(item => item.quantity_on_hand <= item.par_level).length === 0 && (
                <p className="rounded-lg border border-line bg-coal px-3 py-6 text-center text-xs text-mist/60">No restocks needed right now.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-ember" />
              <h2 className="text-sm font-semibold text-cream">Inventory Workflow</h2>
            </div>
            <div className="space-y-3 text-xs leading-5 text-mist/70">
              <p className="flex gap-2"><Boxes className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mist/50" />Use par levels to flag when core ingredients and packaging need restock.</p>
              <p className="flex gap-2"><CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mist/50" />Add expiration dates for perishables so they surface before production days.</p>
              <p className="flex gap-2"><Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mist/50" />Track vendor and storage location so staff can find and reorder quickly.</p>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Inventory Item' : 'Add Inventory Item'}
        description="Track counts, reorder points, vendor details, and storage location."
        className="max-w-3xl"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="item_name" className={labelClass}>Item name</label>
            <input id="item_name" className={inputClass} value={form.item_name} onChange={event => setForm(prev => ({ ...prev, item_name: event.target.value }))} placeholder="Chicken Breast" />
          </div>
          <div>
            <label htmlFor="sku" className={labelClass}>SKU / internal code</label>
            <input id="sku" className={inputClass} value={form.sku} onChange={event => setForm(prev => ({ ...prev, sku: event.target.value }))} placeholder="PRO-CHX-001" />
          </div>
          <div>
            <label htmlFor="category" className={labelClass}>Category</label>
            <select id="category" className={inputClass} value={form.category} onChange={event => setForm(prev => ({ ...prev, category: event.target.value }))}>
              {categories.filter(option => option !== 'All Categories').map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="unit" className={labelClass}>Unit</label>
            <select id="unit" className={inputClass} value={form.unit} onChange={event => setForm(prev => ({ ...prev, unit: event.target.value }))}>
              {units.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="quantity_on_hand" className={labelClass}>Quantity on hand</label>
            <input id="quantity_on_hand" type="number" min="0" step="0.01" className={inputClass} value={form.quantity_on_hand} onChange={event => setForm(prev => ({ ...prev, quantity_on_hand: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="par_level" className={labelClass}>Par level</label>
            <input id="par_level" type="number" min="0" step="0.01" className={inputClass} value={form.par_level} onChange={event => setForm(prev => ({ ...prev, par_level: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="reorder_quantity" className={labelClass}>Reorder quantity</label>
            <input id="reorder_quantity" type="number" min="0" step="0.01" className={inputClass} value={form.reorder_quantity} onChange={event => setForm(prev => ({ ...prev, reorder_quantity: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="cost_per_unit" className={labelClass}>Cost per unit</label>
            <input id="cost_per_unit" type="number" min="0" step="0.01" className={inputClass} value={form.cost_per_unit} onChange={event => setForm(prev => ({ ...prev, cost_per_unit: event.target.value }))} placeholder="3.25" />
          </div>
          <div>
            <label htmlFor="vendor" className={labelClass}>Vendor</label>
            <input id="vendor" className={inputClass} value={form.vendor} onChange={event => setForm(prev => ({ ...prev, vendor: event.target.value }))} placeholder="Restaurant Depot" />
          </div>
          <div>
            <label htmlFor="storage_location" className={labelClass}>Storage location</label>
            <input id="storage_location" className={inputClass} value={form.storage_location} onChange={event => setForm(prev => ({ ...prev, storage_location: event.target.value }))} placeholder="Walk-in freezer" />
          </div>
          <div>
            <label htmlFor="expiration_date" className={labelClass}>Expiration date</label>
            <input id="expiration_date" type="date" className={inputClass} value={form.expiration_date} onChange={event => setForm(prev => ({ ...prev, expiration_date: event.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="notes" className={labelClass}>Notes</label>
            <textarea id="notes" className={`${inputClass} min-h-[90px] resize-none`} value={form.notes} onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))} placeholder="Prep usage, vendor notes, substitutions..." />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3 border-t border-line pt-5">
          <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-mist hover:bg-hover hover:text-cream transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors">
            {editing ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
    </ModuleGate>
  );
}
