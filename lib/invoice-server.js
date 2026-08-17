import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function loadInvoiceForUser(invoiceId) {
  const { profile, error: authError } = await getCurrentProfile();
  if (authError || !profile) throw Object.assign(new Error('Not authenticated.'), { status: 401 });
  const { data: invoice, error } = await supabaseAdmin.from('invoices').select('*').eq('id', invoiceId).single();
  if (error || !invoice) throw Object.assign(new Error('Invoice not found.'), { status: 404 });
  if (!isSuperAdmin(profile) && profile.account_id !== invoice.account_id) {
    throw Object.assign(new Error('You cannot access this invoice.'), { status: 403 });
  }
  const { data: business } = await supabaseAdmin.from('business_profiles').select('*').eq('account_id', invoice.account_id).maybeSingle();
  return { invoice, business: business || {} };
}
