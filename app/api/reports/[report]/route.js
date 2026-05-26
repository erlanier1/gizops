import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const REPORTS = {
  'operations-overview': {
    title: 'Operations Overview',
    description: 'Snapshot of bookings, confirmed revenue, permits, and document counts.',
  },
  'booking-pipeline': {
    title: 'Booking Pipeline',
    description: 'Bookings grouped by status with event dates, client details, and quoted value.',
  },
  'revenue-summary': {
    title: 'Revenue Summary',
    description: 'Confirmed booking value, deposits expected, and deposit payment status.',
  },
  'permit-compliance': {
    title: 'Permit Compliance',
    description: 'Permit inventory with expiration status and renewal urgency.',
  },
  'document-inventory': {
    title: 'Document Inventory',
    description: 'Uploaded operational documents grouped by type and upload date.',
  },
};

const ALLOWED_ROLES = ['owner', 'manager', 'super_admin'];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function formatDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US');
}

function daysUntil(value) {
  if (!value) return null;
  return Math.floor((new Date(`${value}T00:00:00`).getTime() - Date.now()) / 86400000);
}

function permitStatus(expirationDate) {
  const days = daysUntil(expirationDate);
  if (days == null) return 'Unknown';
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring soon';
  return 'Active';
}

async function requireAccess() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { error: Response.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, account_id')
    .eq('id', session.user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return { error: Response.json({ error: 'You do not have access to reports.' }, { status: 403 }) };
  }

  return { session, profile };
}

async function runScopedQuery(table, accountId, orderColumn, orderOptions) {
  let query = supabaseAdmin.from(table).select('*');
  if (accountId) query = query.eq('account_id', accountId);
  const result = await query.order(orderColumn, orderOptions);

  if (result.error && accountId && result.error.message?.toLowerCase().includes('account_id')) {
    return supabaseAdmin.from(table).select('*').order(orderColumn, orderOptions);
  }

  return result;
}

async function fetchReportData(accountId) {
  const [bookingsRes, permitsRes, docsRes] = await Promise.all([
    runScopedQuery('bookings', accountId, 'event_date', { ascending: true }),
    runScopedQuery('permits', accountId, 'expiration_date', { ascending: true }),
    runScopedQuery('documents', accountId, 'created_at', { ascending: false }),
  ]);

  return {
    bookings: bookingsRes.data ?? [],
    permits: permitsRes.data ?? [],
    documents: docsRes.data ?? [],
  };
}

function getRows(reportId, data) {
  const { bookings, permits, documents } = data;

  if (reportId === 'booking-pipeline') {
    return {
      columns: ['Client', 'Email', 'Event Date', 'Event Type', 'Status', 'Guests', 'Quote', 'Deposit', 'Deposit Paid'],
      rows: bookings.map(b => [
        b.client_name,
        b.client_email,
        formatDate(b.event_date),
        b.event_type,
        b.status,
        b.guest_count ?? '',
        formatCurrency(b.quote_amount),
        formatCurrency(b.deposit_amount),
        b.deposit_paid ? 'Yes' : 'No',
      ]),
    };
  }

  if (reportId === 'revenue-summary') {
    return {
      columns: ['Client', 'Status', 'Event Date', 'Quote Amount', 'Deposit Amount', 'Deposit Paid'],
      rows: bookings.map(b => [
        b.client_name,
        b.status,
        formatDate(b.event_date),
        formatCurrency(b.quote_amount),
        formatCurrency(b.deposit_amount),
        b.deposit_paid ? 'Yes' : 'No',
      ]),
    };
  }

  if (reportId === 'permit-compliance') {
    return {
      columns: ['Permit', 'Agency', 'Permit Number', 'Issue Date', 'Expiration Date', 'Status', 'Days Left'],
      rows: permits.map(p => [
        p.name,
        p.issuing_agency,
        p.permit_number,
        formatDate(p.issue_date),
        formatDate(p.expiration_date),
        permitStatus(p.expiration_date),
        daysUntil(p.expiration_date) ?? '',
      ]),
    };
  }

  if (reportId === 'document-inventory') {
    return {
      columns: ['Document', 'Category', 'File Name', 'Uploaded', 'File Path'],
      rows: documents.map(d => [
        d.name,
        d.category,
        d.file_name,
        d.created_at ? new Date(d.created_at).toLocaleDateString('en-US') : '',
        d.file_url,
      ]),
    };
  }

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const totalQuote = confirmedBookings.reduce((sum, b) => sum + Number(b.quote_amount ?? 0), 0);
  const depositsExpected = bookings.reduce((sum, b) => sum + Number(b.deposit_amount ?? 0), 0);
  const depositsPaid = bookings
    .filter(b => b.deposit_paid)
    .reduce((sum, b) => sum + Number(b.deposit_amount ?? 0), 0);
  const expiringPermits = permits.filter(p => {
    const days = daysUntil(p.expiration_date);
    return days != null && days <= 30;
  });

  return {
    columns: ['Metric', 'Value'],
    rows: [
      ['Total bookings', bookings.length],
      ['Confirmed bookings', confirmedBookings.length],
      ['Confirmed booking value', formatCurrency(totalQuote)],
      ['Deposits expected', formatCurrency(depositsExpected)],
      ['Deposits marked paid', formatCurrency(depositsPaid)],
      ['Tracked permits', permits.length],
      ['Permits expired or expiring within 30 days', expiringPermits.length],
      ['Uploaded documents', documents.length],
    ],
  };
}

function buildTableHtml(columns, rows) {
  return `
    <table>
      <thead>
        <tr>${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function buildDocumentHtml(report, columns, rows) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    p { color: #4b5563; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th { background: #f3f4f6; text-align: left; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: top; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.title)}</h1>
  <p>${escapeHtml(report.description)}</p>
  <p>Generated ${new Date().toLocaleString('en-US')}</p>
  ${buildTableHtml(columns, rows)}
</body>
</html>`;
}

function pdfEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(report, columns, rows) {
  const lines = [
    report.title,
    report.description,
    `Generated ${new Date().toLocaleString('en-US')}`,
    '',
    columns.join(' | '),
    ...rows.map(row => row.join(' | ')),
  ].slice(0, 42);

  const content = [
    'BT',
    '/F1 11 Tf',
    '50 760 Td',
    ...lines.flatMap((line, index) => {
      const font = index === 0 ? ['/F1 16 Tf'] : index === 1 ? ['/F1 10 Tf'] : [];
      return [...font, `(${pdfEscape(line).slice(0, 110)}) Tj`, '0 -18 Td'];
    }),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let offset = '%PDF-1.4\n'.length;
  const xref = ['0000000000 65535 f '];
  for (const object of objects) {
    xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
    offset += Buffer.byteLength(object);
  }

  const body = objects.join('');
  const xrefOffset = Buffer.byteLength('%PDF-1.4\n' + body);
  const trailer = `xref\n0 ${objects.length + 1}\n${xref.join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(`%PDF-1.4\n${body}${trailer}`);
}

function responseFor(format, reportId, report, columns, rows) {
  const safeName = reportId.replace(/[^a-z0-9-]/gi, '-');

  if (format === 'excel') {
    const html = buildDocumentHtml(report, columns, rows);
    return new Response(html, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.xls"`,
      },
    });
  }

  if (format === 'pdf') {
    return new Response(buildPdf(report, columns, rows), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    });
  }

  const html = buildDocumentHtml(report, columns, rows);
  return new Response(html, {
    headers: {
      'Content-Type': 'application/msword; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}.doc"`,
    },
  });
}

export async function GET(req, { params }) {
  const access = await requireAccess();
  if (access.error) return access.error;

  const reportId = params.report;
  const report = REPORTS[reportId];

  if (!report) {
    return Response.json({ error: 'Unknown report.' }, { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'word';
  const requestedAccountId = url.searchParams.get('accountId');
  const accountId = access.profile.role === 'super_admin'
    ? requestedAccountId
    : access.profile.account_id;
  const data = await fetchReportData(accountId);
  const { columns, rows } = getRows(reportId, data);

  return responseFor(format, reportId, report, columns, rows);
}
