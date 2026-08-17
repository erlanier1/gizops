import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const dollars = value => `$${Number(value || 0).toFixed(2)}`;
const methodName = value => ({ credit_card: 'Credit card', cash_app: 'Cash App', zelle: 'Zelle', corporate_check: 'Corporate check' })[value] || value;
const safeText = value => String(value || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E\n]/g, ' ');

function wrap(text, font, size, width) {
  const lines = [];
  for (const paragraph of safeText(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line || ' ');
  }
  return lines;
}

export async function createInvoicePdf(invoice, business) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ember = rgb(0.91, 0.32, 0.10);
  let page = pdf.addPage([612, 792]);
  let y = 744;

  if (business?.logo_url) {
    try {
      const response = await fetch(business.logo_url);
      const bytes = await response.arrayBuffer();
      const image = response.headers.get('content-type')?.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const scaled = image.scaleToFit(86, 58);
      page.drawImage(image, { x: 48, y: y - scaled.height + 8, width: scaled.width, height: scaled.height });
    } catch {}
  }

  page.drawText(safeText(business?.business_name || "Zig's Kitchen"), { x: 150, y, size: 20, font: bold, color: ember });
  y -= 19;
  const companyLine = [business?.address, business?.city, business?.state, business?.postal_code].filter(Boolean).join(', ');
  for (const line of [companyLine, business?.contact_phone, business?.contact_email, business?.website].filter(Boolean)) {
    page.drawText(safeText(line), { x: 150, y, size: 9, font: regular, color: rgb(0.25, 0.25, 0.25) }); y -= 12;
  }

  page.drawText('INVOICE', { x: 456, y: 744, size: 22, font: bold, color: rgb(0.12, 0.12, 0.12) });
  page.drawText(`INV-${String(invoice.invoice_number).padStart(6, '0')}`, { x: 456, y: 724, size: 10, font: bold });
  y = 650;
  page.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: 1, color: ember }); y -= 26;

  const detailRows = [
    ['Bill to', invoice.customer_name], ['Customer email', invoice.customer_email || ''],
    ['Event date', invoice.event_date || ''], ['Guest count', invoice.guest_count ? String(invoice.guest_count) : ''],
    ['Event location', invoice.event_location || ''], ['Service type', invoice.service_type || ''],
    ['Payment method', methodName(invoice.provider)], ['Due date', invoice.due_date || ''],
  ];
  detailRows.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? 48 : 314;
    if (index % 2 === 0 && index > 0) y -= 38;
    page.drawText(label.toUpperCase(), { x, y, size: 7, font: bold, color: rgb(0.45, 0.45, 0.45) });
    page.drawText(safeText(value || '-'), { x, y: y - 13, size: 10, font: regular });
  });
  y -= 58;

  page.drawText('EVENT MENU AND SERVICES', { x: 48, y, size: 9, font: bold, color: ember }); y -= 18;
  for (const line of wrap(invoice.description, regular, 9, 516)) {
    if (y < 170) { page = pdf.addPage([612, 792]); y = 744; }
    page.drawText(line, { x: 48, y, size: 9, font: regular, color: rgb(0.18, 0.18, 0.18) }); y -= 13;
  }
  y -= 16;

  const totals = [
    ['Subtotal', dollars(invoice.subtotal)],
    ...(Number(invoice.discount_amount) ? [['Discount', `-${dollars(invoice.discount_amount)}`]] : []),
    [`Sales tax (${Number(invoice.sales_tax_rate || 0).toFixed(2)}%)`, dollars(invoice.sales_tax_amount)],
    ...(Number(invoice.credit_card_fee) ? [['Payment fee (2.5%)', dollars(invoice.credit_card_fee)]] : []),
    ['TOTAL DUE', dollars(invoice.amount)],
    ...(Number(invoice.deposit_amount) ? [['Deposit required', dollars(invoice.deposit_amount)]] : []),
    ['Amount paid', dollars(invoice.amount_paid)],
    ['Remaining balance', dollars(Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid)))],
  ];
  if (y < 220) { page = pdf.addPage([612, 792]); y = 744; }
  totals.forEach(([label, value]) => {
    const isTotal = label === 'TOTAL DUE';
    page.drawText(label, { x: 330, y, size: isTotal ? 11 : 9, font: isTotal ? bold : regular });
    page.drawText(value, { x: 500, y, size: isTotal ? 11 : 9, font: isTotal ? bold : regular }); y -= isTotal ? 22 : 17;
  });
  if (invoice.payment_url) { y -= 8; page.drawText('Payment link:', { x: 48, y, size: 8, font: bold }); page.drawText(safeText(invoice.payment_url).slice(0, 75), { x: 112, y, size: 8, font: regular, color: ember }); }
  page.drawText("Thank you for choosing Zig's Kitchen & Catering.", { x: 48, y: 42, size: 9, font: bold, color: ember });
  return Buffer.from(await pdf.save());
}
