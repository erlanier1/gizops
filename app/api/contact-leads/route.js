import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstClean(...values) {
  for (const value of values) {
    const cleaned = clean(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function cleanList(value) {
  if (Array.isArray(value)) {
    return value.map(item => clean(item)).filter(Boolean).join(', ');
  }

  return clean(value);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeSource(value, fallback) {
  const source = clean(value).toLowerCase().replace(/[\s.-]+/g, '_');
  return ['website', 'manual', 'import', 'event', 'referral', 'form_io', 'formspree'].includes(source)
    ? source
    : fallback;
}

async function parseLeadRequest(req) {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    return Object.fromEntries(formData.entries());
  }

  return req.json();
}

function getFormIoData(body) {
  if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return body.data;
  }

  return body;
}

function getSubmissions(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.submissions)) return body.submissions;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.data)) return body.data;
  return [body];
}

function normalizeLeadPayload(body, req) {
  const data = getFormIoData(body);
  const queryAccountSlug = new URL(req.url).searchParams.get('accountSlug');
  const firstName = clean(data.firstName || data.first_name);
  const lastName = clean(data.lastName || data.last_name);
  const combinedName = [firstName, lastName].filter(Boolean).join(' ');
  const formIoSubmissionId = clean(body._id || body.submissionId || body.submission_id || data._id || data.submissionId || data.submission_id);
  const eventType = firstClean(data.eventType, data.event_type, data.event, body.eventType, body.event_type);
  const guestCount = firstClean(data.guestCount, data.guest_count, data.guests, body.guestCount, body.guest_count);
  const eventDate = firstClean(data.eventDate, data.event_date, data.date, body.eventDate, body.event_date);
  const serviceStyle = firstClean(data.serviceStyle, data.service_style, body.serviceStyle, body.service_style);
  const interests = cleanList(data.interests || data.interestedIn || data.interested_in || data.whatInterested || data.what_interested || body.interests);
  const directMessage = firstClean(data.message, data.comments, data.notes, data.details, data.description, data.eventDetails, data.event_details, body.message);
  const eventSummary = [
    eventType && `Event type: ${eventType}`,
    guestCount && `Guest count: ${guestCount}`,
    eventDate && `Event date: ${eventDate}`,
    serviceStyle && `Service style: ${serviceStyle}`,
    interests && `Interested in: ${interests}`,
    directMessage,
  ].filter(Boolean).join('\n');

  return {
    accountSlug: firstClean(
      queryAccountSlug,
      data.accountSlug,
      data.account_slug,
      data.companySlug,
      data.company_slug,
      body.accountSlug,
      body.account_slug
    ),
    contactName: firstClean(
      data.contactName,
      data.contact_name,
      data.name,
      data.fullName,
      data.full_name,
      combinedName,
      body.contactName,
      body.contact_name,
      body.name
    ),
    email: firstClean(data.email, data.emailAddress, data.email_address, data.contactEmail, data.contact_email, body.email).toLowerCase(),
    phone: firstClean(data.phone, data.phoneNumber, data.phone_number, data.mobile, body.phone),
    companyName: firstClean(data.companyName, data.company_name, data.company, data.businessName, data.business_name, body.companyName, body.company_name),
    serviceInterest: firstClean(data.serviceInterest, data.service_interest, data.service, data.interest, data.projectType, data.project_type, eventType, body.serviceInterest, body.service_interest),
    message: eventSummary,
    source: normalizeSource(firstClean(data.source, body.source), body.data ? 'form_io' : 'formspree'),
    consentToContact: data.consentToContact ?? data.consent_to_contact ?? data.consent ?? body.consentToContact ?? body.consent_to_contact ?? true,
    formIoSubmissionId,
    rawData: body,
  };
}

async function notifyBusiness({ business, lead }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = business.contact_email;

  if (!apiKey || !from || !to) {
    return { sent: false, reason: 'Email notification is not configured.' };
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to,
    subject: `New website contact: ${lead.contact_name}`,
    text: [
      `New website contact for ${business.business_name}`,
      '',
      `Name: ${lead.contact_name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || 'Not provided'}`,
      `Company: ${lead.company_name || 'Not provided'}`,
      `Interest: ${lead.service_interest || 'Not provided'}`,
      '',
      lead.message || 'No message provided.',
    ].join('\n'),
  });

  return { sent: true, reason: null };
}

async function saveLead(body, req) {
  const {
    accountSlug,
    contactName,
    email,
    phone,
    companyName,
    serviceInterest,
    message,
    source,
    consentToContact,
    formIoSubmissionId,
    rawData,
  } = normalizeLeadPayload(body, req);

  if (!accountSlug || !contactName || !email) {
    return { error: 'accountSlug, contactName, and email are required.', status: 400 };
  }

  if (!isEmail(email)) {
    return { error: 'A valid email address is required.', status: 400 };
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from('accounts')
    .select('id, is_active, business_profiles ( business_name, contact_email )')
    .eq('slug', accountSlug)
    .single();

  if (accountError || !account) {
    return { error: 'Company account was not found.', status: 404 };
  }

  if (!account.is_active) {
    return { error: 'Company account is not active.', status: 403 };
  }

  if (formIoSubmissionId) {
    const { data: existingLead } = await supabaseAdmin
      .from('contact_leads')
      .select('id, created_at')
      .eq('account_id', account.id)
      .contains('metadata', { form_io: { submission_id: formIoSubmissionId } })
      .maybeSingle();

    if (existingLead) {
      return {
        success: true,
        duplicate: true,
        leadId: existingLead.id,
        createdAt: existingLead.created_at,
        emailNotification: { sent: false, reason: 'Form.io submission was already imported.' },
      };
    }
  }

  const lead = {
    account_id: account.id,
    source,
    contact_name: contactName,
    email,
    phone: phone || null,
    company_name: companyName || null,
    service_interest: serviceInterest || null,
    message: message || null,
    consent_to_contact: Boolean(consentToContact),
    metadata: {
      user_agent: req.headers.get('user-agent'),
      referer: req.headers.get('referer'),
      form_io: formIoSubmissionId ? { submission_id: formIoSubmissionId } : null,
      raw_submission: ['form_io', 'formspree'].includes(source) ? rawData : undefined,
    },
  };

  const { data: savedLead, error: leadError } = await supabaseAdmin
    .from('contact_leads')
    .insert(lead)
    .select('id, created_at')
    .single();

  if (leadError) {
    return { error: leadError.message, status: 500 };
  }

  const business = account.business_profiles?.[0] ?? {};
  let emailNotification = { sent: false, reason: 'No business contact email found.' };

  if (business.contact_email) {
    try {
      emailNotification = await notifyBusiness({ business, lead });
    } catch (error) {
      emailNotification = { sent: false, reason: error.message ?? 'Email notification failed.' };
    }
  }

  return {
    success: true,
    leadId: savedLead.id,
    createdAt: savedLead.created_at,
    emailNotification,
  };
}

export async function POST(req) {
  try {
    const body = await parseLeadRequest(req);
    const submissions = getSubmissions(body);

    if (submissions.length > 1) {
      const results = [];

      for (const submission of submissions) {
        results.push(await saveLead(submission, req));
      }

      const failed = results.filter(result => result.error);
      return json({
        success: failed.length === 0,
        imported: results.filter(result => result.success && !result.duplicate).length,
        duplicates: results.filter(result => result.duplicate).length,
        failed: failed.length,
        results,
      }, failed.length ? 207 : 200);
    }

    const result = await saveLead(submissions[0], req);
    return json(result, result.status ?? 200);
  } catch (error) {
    return json({ error: 'Failed to capture contact lead.' }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
