import { Resend } from 'resend';
import { createHash, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
const MIN_FORM_FILL_MS = 2500;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

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
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(clean(value).toLowerCase());
}

function getClientIp(req) {
  return clean(req.headers.get('x-forwarded-for')).split(',')[0].trim()
    || clean(req.headers.get('x-real-ip'))
    || 'unknown';
}

function hashClientIp(req) {
  const salt = process.env.LEAD_SPAM_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'gizops-leads';
  return createHash('sha256').update(`${salt}:${getClientIp(req)}`).digest('hex');
}

function hasTooManyLinks(value) {
  return (clean(value).match(/(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|xyz|top|click)\b)/gi) || []).length > 2;
}

function hasSuspiciousText(value) {
  const text = clean(value);
  if (!text) return false;
  return hasTooManyLinks(text)
    || /(.)\1{14,}/.test(text)
    || /\b(?:crypto investment|casino bonus|guest post|seo services|backlinks?|loan approval)\b/i.test(text);
}

function constantTimeMatch(actual, expected) {
  const actualBuffer = Buffer.from(clean(actual));
  const expectedBuffer = Buffer.from(clean(expected));
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function looksLikeBrowserForm(data) {
  return clean(data.source).toLowerCase() === 'website';
}

function screenSubmission(body) {
  const data = getFormIoData(body);

  // Real visitors never see or fill this field. Return a generic success for bots.
  if (clean(data.fax_number || data.faxNumber)) {
    return { blocked: true, reason: 'honeypot' };
  }

  if (looksLikeBrowserForm(data)) {
    const startedAt = Number(data.form_started_at || data.formStartedAt);
    const elapsed = Date.now() - startedAt;
    if (Number.isFinite(startedAt) && (elapsed < MIN_FORM_FILL_MS || elapsed > MAX_FORM_AGE_MS)) {
      return { blocked: true, reason: 'invalid_form_timing' };
    }
  }

  const combinedText = [data.message, data.comments, data.notes, data.details, data.description].join(' ');
  if (hasSuspiciousText(combinedText)) {
    return { blocked: true, reason: 'suspicious_content' };
  }

  return { blocked: false };
}

function validateWebhookSecret(req, body) {
  const expected = process.env.LEAD_WEBHOOK_SECRET;
  if (!expected || !body?.data) return true;
  return constantTimeMatch(req.headers.get('x-gizops-lead-secret'), expected);
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
    consentToContact: asBoolean(data.consentToContact ?? data.consent_to_contact ?? data.consent ?? body.consentToContact ?? body.consent_to_contact ?? true),
    formIoSubmissionId,
    rawData: body,
  };
}

async function notifyBusiness({ business, lead }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = business.contact_email || process.env.ALERT_EMAIL;

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
  const screening = screenSubmission(body);
  if (screening.blocked) {
    console.warn('Blocked suspected lead spam.', { reason: screening.reason });
    return { success: true, filtered: true };
  }

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

  if (
    contactName.length > 120
    || phone.length > 40
    || companyName.length > 160
    || serviceInterest.length > 160
    || message.length > 5000
  ) {
    return { error: 'One or more fields exceed the allowed length.', status: 400 };
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


  const ipHash = hashClientIp(req);
  const rateLimitStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentIpCount, error: rateLimitError } = await supabaseAdmin
    .from('contact_leads')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', account.id)
    .eq('metadata->>ip_hash', ipHash)
    .gte('created_at', rateLimitStart);

  if (rateLimitError) {
    console.error('Lead rate-limit check failed.', rateLimitError);
  } else if ((recentIpCount ?? 0) >= RATE_LIMIT_MAX) {
    return { error: 'Too many requests. Please wait a few minutes and try again.', status: 429 };
  }

  const duplicateStart = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: recentMatches, error: duplicateError } = await supabaseAdmin
    .from('contact_leads')
    .select('id, created_at, message')
    .eq('account_id', account.id)
    .eq('email', email)
    .gte('created_at', duplicateStart)
    .limit(10);

  if (duplicateError) {
    console.error('Lead duplicate check failed.', duplicateError);
  } else {
    const duplicate = recentMatches?.find(item => clean(item.message) === clean(message));
    if (duplicate) {
      return {
        success: true,
        duplicate: true,
        leadId: duplicate.id,
        createdAt: duplicate.created_at,
        emailNotification: { sent: false, reason: 'An identical recent submission already exists.' },
      };
    }
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
      ip_hash: ipHash,
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

  const relatedBusiness = account.business_profiles;
  const business = (Array.isArray(relatedBusiness) ? relatedBusiness[0] : relatedBusiness) ?? {};
  let emailNotification = { sent: false, reason: 'No business contact email found.' };

  if (business.contact_email || process.env.ALERT_EMAIL) {
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
    if (!validateWebhookSecret(req, body)) {
      return json({ error: 'Invalid webhook credentials.' }, 401);
    }
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
