import { Resend } from 'resend';
import { createInvoicePdf } from '@/lib/invoice-document';
import { supabaseAdmin } from '@/lib/supabase-admin';

const escapeHtml = value => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export async function sendCustomerInvoiceEmail(invoice, business = {}) {
  if (!invoice.customer_email) throw Object.assign(new Error('Add a customer email before sending.'), { status: 400 });
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = business.invoice_from_email;
  if (!apiKey || !senderEmail) throw Object.assign(new Error('Invoice email is not configured for this business.'), { status: 500 });

  const pdf = await createInvoicePdf(invoice, business);
  const number = `INV-${String(invoice.invoice_number).padStart(6, '0')}`;
  const company = business.business_name || "Zig's Kitchen & Catering";
  const from = senderEmail.includes('<') ? senderEmail : `${company} <${senderEmail}>`;
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: invoice.customer_email,
    replyTo: business.contact_email || senderEmail,
    subject: `${company} invoice ${number}`,
    text: `Hello ${invoice.customer_name},\n\nAttached is invoice ${number} for ${invoice.event_date || 'your event'}. Total due: $${Number(invoice.amount).toFixed(2)}.\n${invoice.payment_url ? `Payment link: ${invoice.payment_url}\n` : ''}\nThank you,\n${company}`,
    html: `<div style="font-family:Arial,sans-serif;color:#302a22;line-height:1.55;max-width:640px"><h2 style="color:#e8521a">${escapeHtml(company)}</h2><p>Hello ${escapeHtml(invoice.customer_name)},</p><p>Your invoice <strong>${number}</strong> is attached.</p><p style="font-size:22px"><strong>Total due: $${Number(invoice.amount).toFixed(2)}</strong></p>${invoice.payment_url ? `<p><a href="${escapeHtml(invoice.payment_url)}" style="background:#e8521a;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open payment link</a></p>` : ''}<p>Thank you,<br>${escapeHtml(company)}</p></div>`,
    attachments: [{ filename: `${number}.pdf`, content: pdf }],
  });
  if (error) throw new Error(error.message || 'Invoice email could not be sent.');

  const emailedAt = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin.from('invoices').update({ emailed_at: emailedAt, updated_at: emailedAt }).eq('id', invoice.id);
  if (updateError) throw new Error('The invoice was emailed, but its send status could not be recorded.');
  return { emailedAt };
}
