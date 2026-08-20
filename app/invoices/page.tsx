'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { BadgeDollarSign, Copy, Download, ExternalLink, Loader2, Mail, Plus, RefreshCw, X } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Toast } from '@/components/ui/toast';
import { useAccountScope } from '@/lib/account-scope';

type Provider = 'credit_card' | 'cash_app' | 'zelle' | 'corporate_check' | 'paypal' | 'stripe';
type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';

type Invoice = {
  id: string;
  invoice_number: number;
  customer_name: string;
  customer_email: string | null;
  event_date: string | null;
  guest_count: number | null;
  event_location: string | null;
  service_type: string | null;
  description: string;
  subtotal: number;
  discount_amount: number;
  sales_tax_rate: number;
  sales_tax_amount: number;
  amount: number;
  credit_card_fee: number;
  deposit_amount: number;
  amount_paid: number;
  currency: string;
  due_date: string | null;
  provider: Provider;
  provider_reference: string | null;
  payment_url: string | null;
  status: InvoiceStatus;
  notes: string | null;
  emailed_at: string | null;
  created_at: string;
};

const blankForm = {
  customerName: '',
  customerEmail: '',
  eventDate: '',
  guestCount: '',
  eventLocation: '',
  serviceType: '',
  description: '',
  amount: '',
  discountAmount: '',
  salesTaxRate: '',
  depositAmount: '',
  dueDate: '',
  provider: 'credit_card' as Provider,
  paymentUrl: '',
  notes: '',
};

const inputClass = 'w-full rounded-lg border border-line bg-coal px-3 py-2 text-sm text-cream focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember';
const statuses: InvoiceStatus[] = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'];

function money(amount: number, currency = 'USD') {
  return amount.toLocaleString('en-US', { style: 'currency', currency });
}

function invoiceLabel(invoiceNumber: number) {
  return `INV-${String(invoiceNumber).padStart(6, '0')}`;
}

function paymentMethodLabel(provider: Provider) {
  return ({
    credit_card: 'Credit card',
    cash_app: 'Cash App',
    zelle: 'Zelle',
    corporate_check: 'Corporate check',
    paypal: 'PayPal (legacy)',
    stripe: 'Stripe (legacy)',
  })[provider];
}

function statusClass(status: InvoiceStatus) {
  if (status === 'paid') return 'border-green-800 bg-green-900/30 text-green-400';
  if (status === 'partially_paid') return 'border-cyan-800 bg-cyan-900/30 text-cyan-300';
  if (status === 'overdue') return 'border-red-800 bg-red-900/30 text-red-400';
  if (status === 'void') return 'border-line bg-coal text-mist/50';
  if (status === 'draft') return 'border-amber-800 bg-amber-900/30 text-amber-400';
  return 'border-blue-800 bg-blue-900/30 text-blue-400';
}

export default function InvoicesPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const { selectedAccount, selectedAccountId } = useAccountScope();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [form, setForm] = useState(blankForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [recordingPayment, setRecordingPayment] = useState<string | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    if (!selectedAccountId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, customer_email, event_date, guest_count, event_location, service_type, description, subtotal, discount_amount, sales_tax_rate, sales_tax_amount, amount, credit_card_fee, deposit_amount, amount_paid, currency, due_date, provider, provider_reference, payment_url, status, notes, emailed_at, created_at')
      .eq('account_id', selectedAccountId)
      .order('created_at', { ascending: false });
    if (error) {
      setInvoices([]);
      setToast({ message: error.message, type: 'error' });
    } else {
      setInvoices((data ?? []) as Invoice[]);
    }
    setLoading(false);
  }, [selectedAccountId, supabase]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const visibleInvoices = useMemo(
    () => statusFilter === 'all' ? invoices : invoices.filter(invoice => invoice.status === statusFilter),
    [invoices, statusFilter]
  );

  const totals = useMemo(() => ({
    outstanding: invoices.filter(invoice => invoice.status !== 'void').reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid || 0)), 0),
    paid: invoices.filter(invoice => invoice.status !== 'void').reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0),
  }), [invoices]);

  const subtotalPreview = Number(form.amount || 0);
  const discountPreview = Math.min(subtotalPreview, Math.max(0, Number(form.discountAmount || 0)));
  const taxablePreview = Math.max(0, subtotalPreview - discountPreview);
  const salesTaxPreview = Number((taxablePreview * Math.max(0, Number(form.salesTaxRate || 0)) / 100).toFixed(2));
  const preFeePreview = taxablePreview + salesTaxPreview;
  const paymentFeePreview = ['credit_card', 'cash_app'].includes(form.provider) ? Number((preFeePreview * 0.025).toFixed(2)) : 0;
  const totalDuePreview = preFeePreview + paymentFeePreview;

  const createInvoice = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAccountId) {
      setToast({ message: 'Select a company workspace first.', type: 'error' });
      return;
    }
    const amount = Number(form.amount);
    const discountAmount = Number(form.discountAmount || 0);
    const salesTaxRate = Number(form.salesTaxRate || 0);
    const depositAmount = Number(form.depositAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast({ message: 'Enter a valid invoice amount.', type: 'error' });
      return;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > amount) {
      setToast({ message: 'Discount must be between $0.00 and the event subtotal.', type: 'error' });
      return;
    }
    if (!Number.isFinite(salesTaxRate) || salesTaxRate < 0 || salesTaxRate > 100) {
      setToast({ message: 'Sales tax must be between 0% and 100%.', type: 'error' });
      return;
    }
    const taxableAmount = amount - discountAmount;
    const salesTaxAmount = Number((taxableAmount * salesTaxRate / 100).toFixed(2));
    const preFeeTotal = taxableAmount + salesTaxAmount;
    const paymentFee = ['credit_card', 'cash_app'].includes(form.provider) ? Number((preFeeTotal * 0.025).toFixed(2)) : 0;
    const invoiceTotal = preFeeTotal + paymentFee;
    if (!Number.isFinite(depositAmount) || depositAmount < 0 || depositAmount > invoiceTotal) {
      setToast({ message: 'Deposit must be between $0.00 and the invoice total.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
        account_id: selectedAccountId,
        customer_name: form.customerName.trim(),
        customer_email: form.customerEmail.trim() || null,
        event_date: form.eventDate || null,
        guest_count: form.guestCount ? Number(form.guestCount) : null,
        event_location: form.eventLocation.trim() || null,
        service_type: form.serviceType.trim() || null,
        description: form.description.trim(),
        subtotal: amount,
        discount_amount: discountAmount,
        sales_tax_rate: salesTaxRate,
        sales_tax_amount: salesTaxAmount,
        amount: invoiceTotal,
        credit_card_fee: paymentFee,
        deposit_amount: depositAmount,
        amount_paid: 0,
        due_date: form.dueDate || null,
        provider: form.provider,
        provider_reference: null,
        payment_url: form.paymentUrl.trim() || null,
        status: 'sent',
        notes: form.notes.trim() || null,
        }),
      });
      window.clearTimeout(timeout);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Invoice could not be saved.');
      const data = body.invoice;

      setInvoices(previous => [data as Invoice, ...previous]);
      setForm(blankForm);
      setShowForm(false);
      setToast(body.email?.sent
        ? { message: `Invoice saved and emailed to ${data.customer_email}.`, type: 'success' }
        : { message: `Invoice saved, but the email was not sent: ${body.email?.error || 'Unknown email error'}`, type: 'error' });
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'The save took too long. Please check your connection and try again.'
        : error instanceof Error ? error.message : 'Invoice creation failed.';
      setToast({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (invoice: Invoice, status: InvoiceStatus) => {
    const { error } = await supabase.from('invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', invoice.id);
    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }
    setInvoices(previous => previous.map(item => item.id === invoice.id ? { ...item, status } : item));
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setToast({ message: 'Payment link copied.', type: 'success' });
  };

  const emailInvoice = async (invoice: Invoice) => {
    setSendingInvoice(invoice.id);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/email`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Invoice email could not be sent.');
      const emailedAt = new Date().toISOString();
      setInvoices(previous => previous.map(item => item.id === invoice.id ? { ...item, emailed_at: emailedAt } : item));
      setToast({ message: `Invoice emailed to ${invoice.customer_email}.`, type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Invoice email could not be sent.', type: 'error' });
    } finally {
      setSendingInvoice(null);
    }
  };

  const recordPayment = async (invoice: Invoice) => {
    const payment = Number(paymentAmounts[invoice.id]);
    const currentPaid = Number(invoice.amount_paid || 0);
    const remaining = Math.max(0, Number(invoice.amount) - currentPaid);
    if (!Number.isFinite(payment) || payment <= 0 || payment > remaining) {
      setToast({ message: `Enter a payment between $0.01 and ${money(remaining)}.`, type: 'error' });
      return;
    }
    setRecordingPayment(invoice.id);
    const amountPaid = Math.min(Number(invoice.amount), currentPaid + payment);
    const status: InvoiceStatus = amountPaid >= Number(invoice.amount) ? 'paid' : 'partially_paid';
    const { error } = await supabase.from('invoices').update({ amount_paid: amountPaid, status, updated_at: new Date().toISOString() }).eq('id', invoice.id);
    setRecordingPayment(null);
    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }
    setInvoices(previous => previous.map(item => item.id === invoice.id ? { ...item, amount_paid: amountPaid, status } : item));
    setPaymentAmounts(previous => ({ ...previous, [invoice.id]: '' }));
    setToast({ message: `${money(payment)} payment recorded. ${money(Number(invoice.amount) - amountPaid)} remains due.`, type: 'success' });
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={selectedAccount ? `Create and track PayPal or Stripe invoices for ${selectedAccount.name}.` : 'Create and track PayPal or Stripe invoices.'}
        action={selectedAccountId ? (
          <button type="button" onClick={() => setShowForm(value => !value)} className="inline-flex items-center gap-2 rounded-lg bg-ember px-3 py-2 text-xs font-medium text-white hover:bg-ember-dark">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Close' : 'New Invoice'}
          </button>
        ) : undefined}
      />

      {!selectedAccountId && (
        <div className="mb-5 rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">Select a company workspace from the sidebar to manage its invoices.</div>
      )}

      {showForm && selectedAccountId && (
        <form onSubmit={createInvoice} className="mb-6 rounded-xl border border-line bg-smoke p-5">
          <div className="mb-4 flex items-center gap-2"><BadgeDollarSign className="h-5 w-5 text-ember" /><h2 className="font-semibold text-cream">New Invoice</h2></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-medium text-mist">Customer name<input required className={`${inputClass} mt-1.5`} value={form.customerName} onChange={event => setForm({ ...form, customerName: event.target.value })} /></label>
            <label className="text-xs font-medium text-mist">Customer email<input type="email" className={`${inputClass} mt-1.5`} value={form.customerEmail} onChange={event => setForm({ ...form, customerEmail: event.target.value })} /></label>
            <label className="text-xs font-medium text-mist">Event date<input type="date" className={`${inputClass} mt-1.5`} value={form.eventDate} onChange={event => setForm({ ...form, eventDate: event.target.value })} /></label>
            <label className="text-xs font-medium text-mist">Guest count<input min="1" step="1" type="number" className={`${inputClass} mt-1.5`} value={form.guestCount} onChange={event => setForm({ ...form, guestCount: event.target.value })} placeholder="Number of guests" /></label>
            <label className="text-xs font-medium text-mist">Event location<input className={`${inputClass} mt-1.5`} value={form.eventLocation} onChange={event => setForm({ ...form, eventLocation: event.target.value })} placeholder="Venue or full address" /></label>
            <label className="text-xs font-medium text-mist">Service type<input className={`${inputClass} mt-1.5`} value={form.serviceType} onChange={event => setForm({ ...form, serviceType: event.target.value })} placeholder="Catering, food truck, delivery..." /></label>
            <label className="text-xs font-medium text-mist">Event subtotal (USD)<span className="relative mt-1.5 block"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-mist">$</span><input required min="0.01" step="0.01" type="number" inputMode="decimal" className={`${inputClass} pl-7`} value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></span></label>
            <label className="text-xs font-medium text-mist">Discount (USD)<span className="relative mt-1.5 block"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-mist">$</span><input min="0" step="0.01" type="number" inputMode="decimal" className={`${inputClass} pl-7`} value={form.discountAmount} onChange={event => setForm({ ...form, discountAmount: event.target.value })} placeholder="0.00" /></span></label>
            <label className="text-xs font-medium text-mist">Sales tax rate<span className="relative mt-1.5 block"><input min="0" max="100" step="0.01" type="number" inputMode="decimal" className={`${inputClass} pr-8`} value={form.salesTaxRate} onChange={event => setForm({ ...form, salesTaxRate: event.target.value })} placeholder="0.00" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-mist">%</span></span></label>
            <label className="text-xs font-medium text-mist">Deposit required (USD)<span className="relative mt-1.5 block"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-mist">$</span><input min="0" step="0.01" type="number" inputMode="decimal" className={`${inputClass} pl-7`} value={form.depositAmount} onChange={event => setForm({ ...form, depositAmount: event.target.value })} placeholder="0.00" /></span></label>
            <label className="text-xs font-medium text-mist">Due date<input type="date" className={`${inputClass} mt-1.5`} value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} /></label>
            <label className="text-xs font-medium text-mist">Payment method<select className={`${inputClass} mt-1.5`} value={form.provider} onChange={event => setForm({ ...form, provider: event.target.value as Provider })}><option value="credit_card">Credit card — add 2.5% fee</option><option value="cash_app">Cash App — add 2.5% fee</option><option value="zelle">Zelle</option><option value="corporate_check">Corporate check only</option></select></label>
            <label className="text-xs font-medium text-mist">Payment link (optional)<input type="url" placeholder="Paste the payment link" className={`${inputClass} mt-1.5`} value={form.paymentUrl} onChange={event => setForm({ ...form, paymentUrl: event.target.value })} /></label>
            <div className="rounded-lg border border-line bg-coal p-4 text-sm md:col-span-2"><div className="flex justify-between text-mist"><span>Subtotal</span><span>{money(subtotalPreview)}</span></div>{discountPreview > 0 && <div className="mt-1 flex justify-between text-green-400"><span>Discount</span><span>-{money(discountPreview)}</span></div>}<div className="mt-1 flex justify-between text-mist"><span>Sales tax ({Number(form.salesTaxRate || 0).toFixed(2)}%)</span><span>{money(salesTaxPreview)}</span></div>{paymentFeePreview > 0 && <div className="mt-1 flex justify-between text-amber-300"><span>Payment fee (2.5%)</span><span>{money(paymentFeePreview)}</span></div>}<div className="mt-3 flex justify-between border-t border-line pt-3 text-base font-bold text-cream"><span>Total Due</span><span>{money(totalDuePreview)}</span></div></div>
            <label className="text-xs font-medium text-mist md:col-span-2">Event menu and services<textarea required rows={10} className={`${inputClass} mt-1.5 min-h-56 resize-y leading-6`} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Add the complete event menu, quantities, service details, rentals, staffing, delivery, and other event notes." /></label>
            <label className="text-xs font-medium text-mist md:col-span-2">Internal notes<textarea rows={3} className={`${inputClass} mt-1.5`} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} /></label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4"><p className="text-xs text-mist/60">Accepted: credit card, Cash App, Zelle, and corporate checks only.</p><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Invoice</button></div>
        </form>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-smoke p-4"><p className="text-xs text-mist">Invoices</p><p className="mt-1 text-2xl font-bold text-cream">{invoices.length}</p></div>
        <div className="rounded-xl border border-line bg-smoke p-4"><p className="text-xs text-mist">Outstanding</p><p className="mt-1 text-2xl font-bold text-amber-400">{money(totals.outstanding)}</p></div>
        <div className="rounded-xl border border-line bg-smoke p-4"><p className="text-xs text-mist">Paid</p><p className="mt-1 text-2xl font-bold text-green-400">{money(totals.paid)}</p></div>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-smoke">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-cream">Invoice Ledger</h2>
          <div className="flex gap-2"><select className={inputClass} value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | InvoiceStatus)}><option value="all">All statuses</option>{statuses.map(status => <option key={status}>{status}</option>)}</select><button type="button" onClick={fetchInvoices} className="rounded-lg border border-line px-3 text-mist hover:bg-hover"><RefreshCw className="h-4 w-4" /></button></div>
        </div>
        {loading ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ember" /></div> : visibleInvoices.length === 0 ? <div className="px-5 py-12 text-sm text-mist/70">No invoices match this view.</div> : <div className="divide-y divide-line">{visibleInvoices.map(invoice => (
          <article key={invoice.id} className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-cream">{invoice.customer_name}</h3><span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[10px] font-semibold text-ember">{invoiceLabel(invoice.invoice_number)}</span><span className="rounded-full border border-line bg-coal px-2 py-0.5 text-[10px] font-semibold text-mist">{paymentMethodLabel(invoice.provider)}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(invoice.status)}`}>{invoice.status}</span></div><p className="mt-1 text-xs text-mist/60">{invoice.customer_email || 'No email'} · {new Date(invoice.created_at).toLocaleDateString()}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-mist">{invoice.description}</p>{invoice.notes && <p className="mt-2 text-xs text-mist/60">{invoice.notes}</p>}</div>
              <div className="min-w-64"><p className="text-xl font-bold text-cream">{money(Number(invoice.amount), invoice.currency)}</p>{Number(invoice.credit_card_fee || 0) > 0 && <p className="text-xs text-amber-300">Includes 2.5% card fee: {money(Number(invoice.credit_card_fee), invoice.currency)}</p>}{Number(invoice.deposit_amount || 0) > 0 && <p className="text-xs text-cyan-300">Deposit required: {money(Number(invoice.deposit_amount), invoice.currency)}</p>}<p className="text-xs text-green-400">Paid: {money(Number(invoice.amount_paid || 0), invoice.currency)}</p><p className="text-xs font-semibold text-amber-400">Balance due: {money(Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid || 0)), invoice.currency)}</p><p className="mb-3 mt-1 text-xs text-mist/60">{invoice.due_date ? `Due ${new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString()}` : 'No due date'}</p><div className="mb-2 flex gap-2"><input aria-label={`Payment amount for ${invoice.customer_name}`} min="0.01" max={Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid || 0))} step="0.01" type="number" placeholder="Payment amount" className={inputClass} value={paymentAmounts[invoice.id] ?? ''} onChange={event => setPaymentAmounts(previous => ({ ...previous, [invoice.id]: event.target.value }))} disabled={invoice.status === 'paid' || invoice.status === 'void'} /><button type="button" onClick={() => recordPayment(invoice)} disabled={recordingPayment === invoice.id || invoice.status === 'paid' || invoice.status === 'void'} className="whitespace-nowrap rounded-lg bg-ember px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{recordingPayment === invoice.id ? 'Saving…' : 'Record Payment'}</button></div><div className="flex gap-2">{invoice.payment_url && <><button type="button" onClick={() => copyLink(invoice.payment_url!)} className="rounded-lg border border-line p-2 text-mist hover:bg-hover" title="Copy payment link"><Copy className="h-4 w-4" /></button><a href={invoice.payment_url} target="_blank" rel="noreferrer" className="rounded-lg border border-line p-2 text-mist hover:bg-hover" title="Open payment link"><ExternalLink className="h-4 w-4" /></a></>}<select aria-label={`Status for ${invoice.customer_name}`} className={inputClass} value={invoice.status} onChange={event => updateStatus(invoice, event.target.value as InvoiceStatus)}>{statuses.map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></div></div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-mist/70"><span>Event: {invoice.event_date ? new Date(`${invoice.event_date}T00:00:00`).toLocaleDateString() : 'Not set'}</span><span>Guests: {invoice.guest_count || 'Not set'}</span><span>Service: {invoice.service_type || 'Not set'}</span><span>Location: {invoice.event_location || 'Not set'}</span></div>
              <div className="flex shrink-0 gap-2"><a href={`/api/invoices/${invoice.id}/pdf`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover"><Download className="h-4 w-4" />Download PDF</a><button type="button" onClick={() => emailInvoice(invoice)} disabled={sendingInvoice === invoice.id || !invoice.customer_email} className="inline-flex items-center gap-1.5 rounded-lg bg-ember px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{sendingInvoice === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Email Invoice</button></div>
            </div>
          </article>
        ))}</div>}
      </section>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
