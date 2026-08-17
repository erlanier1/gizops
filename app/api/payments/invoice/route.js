import { paypalRequest } from '@/lib/paypal';
import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ''));
}

export async function POST(req) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError || !profile) {
      return Response.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const {
      accountId,
      bookingId,
      clientName,
      email,
      amount,
      description = 'Corporate meal prep invoice',
      daysUntilDue = 14,
    } = await req.json();

    if (!accountId) {
      return Response.json({ error: 'A company workspace is required.' }, { status: 400 });
    }

    if (!isSuperAdmin(profile) && profile.account_id !== accountId) {
      return Response.json({ error: 'You cannot create invoices for another company.' }, { status: 403 });
    }

    if (!['owner', 'manager', 'super_admin'].includes(profile.role)) {
      return Response.json({ error: 'You do not have permission to create invoices.' }, { status: 403 });
    }

    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('name, business_profiles ( business_name, legal_name, contact_email, contact_phone, website, logo_url, address, city, state, postal_code )')
      .eq('id', accountId)
      .single();
    const relatedBusiness = account?.business_profiles;
    const business = (Array.isArray(relatedBusiness) ? relatedBusiness[0] : relatedBusiness) ?? {};
    const invoiceBusinessName = business.legal_name || business.business_name || account?.name || process.env.PAYPAL_INVOICER_NAME || 'GizOps';
    const invoicer = compactObject({
      name: { full_name: invoiceBusinessName },
      email_address: business.contact_email || undefined,
      phones: business.contact_phone ? [{ country_code: '001', national_number: String(business.contact_phone).replace(/\D/g, '') }] : undefined,
      website: business.website || undefined,
      logo_url: business.logo_url || undefined,
      address: (business.address || business.city || business.state || business.postal_code) ? compactObject({
        address_line_1: business.address || undefined,
        admin_area_2: business.city || undefined,
        admin_area_1: business.state || undefined,
        postal_code: business.postal_code || undefined,
        country_code: 'US',
      }) : undefined,
    });

    if (!clientName || !email || !amount) {
      return Response.json({ error: 'clientName, email, and amount are required.' }, { status: 400 });
    }

    const invoiceAmount = Number(amount);
    if (!Number.isFinite(invoiceAmount) || invoiceAmount < 1) {
      return Response.json({ error: 'amount must be at least 1.00.' }, { status: 400 });
    }

    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + Math.max(1, Number(daysUntilDue) || 14));

    const invoice = await paypalRequest('/v2/invoicing/invoices', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        detail: {
          currency_code: 'USD',
          note: bookingId ? `GizOps booking ${bookingId}` : 'Created by GizOps',
          payment_term: { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: dueDate.toISOString().slice(0, 10) },
        },
        invoicer,
        primary_recipients: [{ billing_info: { name: { full_name: clientName }, email_address: email } }],
        items: [{
          name: String(description).slice(0, 200),
          quantity: '1',
          unit_amount: { currency_code: 'USD', value: invoiceAmount.toFixed(2) },
        }],
        configuration: {
          allow_tip: false,
          partial_payment: { allow_partial_payment: true },
        },
      }),
    });

    await paypalRequest(`/v2/invoicing/invoices/${encodeURIComponent(invoice.id)}/send`, {
      method: 'POST',
      body: JSON.stringify({ send_to_invoicer: true, send_to_recipient: true }),
    });

    const sentInvoice = await paypalRequest(`/v2/invoicing/invoices/${encodeURIComponent(invoice.id)}`);
    return Response.json({
      invoiceId: invoice.id,
      hostedInvoiceUrl: sentInvoice.detail_metadata?.recipient_view_url || null,
      invoicePdf: null,
    });
  } catch (error) {
    console.error('PayPal invoice error:', error);
    return Response.json({ error: error.message || 'Failed to create invoice.' }, { status: 500 });
  }
}
