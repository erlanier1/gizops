import { Resend } from 'resend';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function appUrl(req) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '');
}

export function invitationRedirectUrl(req) {
  return `${appUrl(req)}/auth/reset-password`;
}

export async function sendGizOpsInvitation({ email, fullName, role, companyName, invitationLink }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      'Invitation email is not configured. Set RESEND_API_KEY and INVITE_FROM_EMAIL (or CONTACT_FROM_EMAIL).'
    );
  }

  const safeName = escapeHtml(fullName);
  const safeCompany = escapeHtml(companyName || 'your company');
  const safeRole = escapeHtml(role);
  const safeLink = escapeHtml(invitationLink);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `You’re invited to ${companyName ? `${companyName} on ` : ''}GizOps`,
    text: [
      `Hi ${fullName},`,
      '',
      `You’ve been invited to join ${companyName || 'your company'} in GizOps as ${role}.`,
      'Open the secure link below to set your password and access your account:',
      invitationLink,
      '',
      'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #302a22; line-height: 1.55;">
        <h2 style="margin: 0 0 12px;">Welcome to GizOps</h2>
        <p>Hi ${safeName},</p>
        <p>You’ve been invited to join <strong>${safeCompany}</strong> as <strong>${safeRole}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${safeLink}" style="background: #e8521a; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">
            Set Password &amp; Open GizOps
          </a>
        </p>
        <p style="font-size: 13px; color: #706454;">If the button does not work, copy and paste this link into your browser:</p>
        <p style="font-size: 13px; word-break: break-all; color: #50463a;">${safeLink}</p>
        <p style="font-size: 13px; color: #706454;">If you were not expecting this invitation, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || 'Invitation email could not be sent.');
  }
}
