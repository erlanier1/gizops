import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAppUrl(req) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

function resetEmailText({ resetLink }) {
  return [
    'Reset your GizOps password',
    '',
    'Use the link below to set a new password:',
    resetLink,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
}

function resetEmailHtml({ resetLink }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">Reset your GizOps password</h2>
      <p>Use the button below to set a new password.</p>
      <p style="margin: 24px 0;">
        <a href="${resetLink}" style="background: #f4511e; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">
          Reset Password
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="font-size: 13px; word-break: break-all; color: #374151;">${resetLink}</p>
      <p style="font-size: 13px; color: #6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

export async function POST(req) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.PASSWORD_RESET_FROM_EMAIL
      || process.env.INVITE_FROM_EMAIL
      || process.env.CONTACT_FROM_EMAIL;

    if (!apiKey || !from) {
      return Response.json(
        { error: 'Password reset email is not configured. Set RESEND_API_KEY and INVITE_FROM_EMAIL.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const email = clean(body.email).toLowerCase();

    if (!isEmail(email)) {
      return Response.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    const redirectTo = `${getAppUrl(req)}/auth/reset-password`;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (error) {
      return Response.json({ error: error.message || 'Password reset link could not be generated.' }, { status: 400 });
    }

    const resetLink = data?.properties?.action_link;
    if (!resetLink) {
      return Response.json({ error: 'Password reset link could not be generated.' }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: email,
      subject: 'Reset your GizOps password',
      text: resetEmailText({ resetLink }),
      html: resetEmailHtml({ resetLink }),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error?.message || 'Password reset email could not be sent.' },
      { status: 500 }
    );
  }
}
