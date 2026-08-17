import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const invoiceFields = 'id, invoice_number, customer_name, customer_email, description, subtotal, discount_amount, sales_tax_rate, sales_tax_amount, amount, credit_card_fee, deposit_amount, amount_paid, currency, due_date, provider, provider_reference, payment_url, status, notes, created_at';
const paymentMethods = ['credit_card', 'cash_app', 'zelle', 'corporate_check'];

export async function POST(req) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError || !profile) return Response.json({ error: 'Not authenticated.' }, { status: 401 });
    if (!['owner', 'manager', 'super_admin'].includes(profile.role)) {
      return Response.json({ error: 'You do not have permission to create invoices.' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.account_id || (!isSuperAdmin(profile) && profile.account_id !== body.account_id)) {
      return Response.json({ error: 'You cannot create invoices for this workspace.' }, { status: 403 });
    }
    if (!body.customer_name || !body.description || !paymentMethods.includes(body.provider)) {
      return Response.json({ error: 'Customer, event details, and a valid payment method are required.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert({ ...body, created_by: profile.id })
      .select(invoiceFields)
      .single();

    if (error) throw error;
    return Response.json({ invoice: data });
  } catch (error) {
    console.error('Invoice save error:', error);
    return Response.json({ error: error.message || 'Invoice could not be saved.' }, { status: 500 });
  }
}
