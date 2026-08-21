import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const invoiceFields = 'id, invoice_number, customer_name, customer_email, event_date, guest_count, event_location, service_type, description, subtotal, discount_amount, sales_tax_rate, sales_tax_amount, amount, credit_card_fee, deposit_amount, amount_paid, currency, due_date, provider, provider_reference, payment_url, status, notes, emailed_at, created_at';
const paymentMethods = ['credit_card', 'cash_app', 'zelle', 'corporate_check', 'paypal', 'stripe'];
const editableFields = ['customer_name', 'customer_email', 'event_date', 'guest_count', 'event_location', 'service_type', 'description', 'subtotal', 'discount_amount', 'sales_tax_rate', 'sales_tax_amount', 'amount', 'credit_card_fee', 'deposit_amount', 'due_date', 'provider', 'payment_url', 'notes'];

export async function PATCH(req, { params }) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError || !profile) return Response.json({ error: 'Not authenticated.' }, { status: 401 });
    if (!['owner', 'manager', 'super_admin'].includes(profile.role)) return Response.json({ error: 'You do not have permission to edit invoices.' }, { status: 403 });
    const { data: current } = await supabaseAdmin.from('invoices').select('id,account_id,amount_paid,status').eq('id', params.id).maybeSingle();
    if (!current) return Response.json({ error: 'Invoice was not found.' }, { status: 404 });
    if (!isSuperAdmin(profile) && profile.account_id !== current.account_id) return Response.json({ error: 'You cannot edit this workspace invoice.' }, { status: 403 });
    const body = await req.json();
    if (!body.customer_name?.trim() || !body.description?.trim() || !paymentMethods.includes(body.provider)) return Response.json({ error: 'Customer, event details, and a valid payment method are required.' }, { status: 400 });
    if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0 || Number(body.amount) < Number(current.amount_paid || 0)) return Response.json({ error: 'Invoice total cannot be below the amount already paid.' }, { status: 400 });
    if (Number(body.deposit_amount || 0) < 0 || Number(body.deposit_amount || 0) > Number(body.amount)) return Response.json({ error: 'Deposit must be between zero and the invoice total.' }, { status: 400 });
    const update = Object.fromEntries(editableFields.filter(field => Object.prototype.hasOwnProperty.call(body, field)).map(field => [field, body[field]]));
    update.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('invoices').update(update).eq('id', current.id).eq('account_id', current.account_id).select(invoiceFields).single();
    if (error) throw error;
    await supabaseAdmin.from('staff_audit_log').insert({ account_id: current.account_id, actor_profile_id: profile.id, action: 'invoice_edited', details: { invoice_id: current.id, invoice_number: data.invoice_number } });
    return Response.json({ invoice: data });
  } catch (error) {
    console.error('Invoice edit error:', error);
    return Response.json({ error: error.message || 'Invoice could not be updated.' }, { status: 500 });
  }
}
