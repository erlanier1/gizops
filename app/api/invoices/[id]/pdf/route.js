import { createInvoicePdf } from '@/lib/invoice-document';
import { loadInvoiceForUser } from '@/lib/invoice-server';

export async function GET(_req, { params }) {
  try {
    const { invoice, business } = await loadInvoiceForUser(params.id);
    const pdf = await createInvoicePdf(invoice, business);
    const number = `INV-${String(invoice.invoice_number).padStart(6, '0')}`;
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message || 'PDF could not be created.' }, { status: error.status || 500 });
  }
}
