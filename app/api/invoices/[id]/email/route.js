import { loadInvoiceForUser } from '@/lib/invoice-server';
import { sendCustomerInvoiceEmail } from '@/lib/invoice-email';

export async function POST(_req, { params }) {
  try {
    const { invoice, business } = await loadInvoiceForUser(params.id);
    const result = await sendCustomerInvoiceEmail(invoice, business);
    return Response.json({ ok: true, emailed_at: result.emailedAt });
  } catch (error) {
    return Response.json({ error: error.message || 'Invoice email could not be sent.' }, { status: error.status || 500 });
  }
}
