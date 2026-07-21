import { paypalRequest } from '@/lib/paypal';

export async function POST(req) {
  try {
    const {
      bookingId,
      clientName,
      email,
      amount,
      description = 'Corporate meal prep invoice',
      daysUntilDue = 14,
    } = await req.json();

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
        invoicer: {
          name: { given_name: process.env.PAYPAL_INVOICER_NAME || 'GizOps' },
        },
        primary_recipients: [{ billing_info: { name: { full_name: clientName }, email_address: email } }],
        items: [{
          name: String(description).slice(0, 200),
          quantity: '1',
          unit_amount: { currency_code: 'USD', value: invoiceAmount.toFixed(2) },
        }],
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
