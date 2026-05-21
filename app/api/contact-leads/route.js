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

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

export async function POST(req) {
  try {
    const body = await req.json();
    const accountSlug = clean(body.accountSlug || body.account_slug);
    const contactName = clean(body.contactName || body.contact_name || body.name);
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const companyName = clean(body.companyName || body.company_name);
    const serviceInterest = clean(body.serviceInterest || body.service_interest);
    const message = clean(body.message);
    const source = clean(body.source) || 'website';
    const consentToContact = body.consentToContact ?? body.consent_to_contact ?? true;

    if (!accountSlug || !contactName || !email) {
      return json(
        { error: 'accountSlug, contactName, and email are required.' },
        400
      );
    }

    if (!isEmail(email)) {
      return json({ error: 'A valid email address is required.' }, 400);
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, is_active, business_profiles ( business_name, contact_email )')
      .eq('slug', accountSlug)
      .single();

    if (accountError || !account) {
      return json({ error: 'Company account was not found.' }, 404);
    }

    if (!account.is_active) {
      return json({ error: 'Company account is not active.' }, 403);
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
      },
    };

    const { data: savedLead, error: leadError } = await supabaseAdmin
      .from('contact_leads')
      .insert(lead)
      .select('id, created_at')
      .single();

    if (leadError) {
      return json({ error: leadError.message }, 500);
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

    return json({
      success: true,
      leadId: savedLead.id,
      createdAt: savedLead.created_at,
      emailNotification,
    });
  } catch (error) {
    return json({ error: 'Failed to capture contact lead.' }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
