import { getAppUrl, getStripe } from '@/lib/stripe';

export async function POST(req) {
  try {
    const stripe = getStripe();
    const {
      bookingId,
      clientName,
      email,
      amount,
      description = 'Corporate meal prep invoice',
      daysUntilDue = 14,
    } = await req.json();

    if (!clientName || !email || !amount) {
      return Response.json(
        { error: 'clientName, email, and amount are required.' },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(Number(amount) * 100);
    if (!Number.isInteger(amountInCents) || amountInCents < 100) {
      return Response.json(
        { error: 'amount must be at least 1.00.' },
        { status: 400 }
      );
    }

    const customer = await stripe.customers.create({
      name: clientName,
      email,
      metadata: {
        bookingId: bookingId ?? '',
      },
    });

    await stripe.invoiceItems.create({
      customer: customer.id,
      currency: 'usd',
      amount: amountInCents,
      description,
      metadata: {
        bookingId: bookingId ?? '',
      },
    });

    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: Number(daysUntilDue) || 14,
      payment_settings: {
        payment_method_types: ['us_bank_account', 'card'],
      },
      metadata: {
        payment_type: 'invoice',
        bookingId: bookingId ?? '',
      },
      custom_fields: [
        { name: 'Portal', value: getAppUrl() },
      ],
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(finalizedInvoice.id);

    return Response.json({
      invoiceId: finalizedInvoice.id,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
      invoicePdf: finalizedInvoice.invoice_pdf,
    });
  } catch (error) {
    console.error('Stripe invoice error:', error);
    return Response.json(
      { error: error.message || 'Failed to create invoice.' },
      { status: 500 }
    );
  }
}

