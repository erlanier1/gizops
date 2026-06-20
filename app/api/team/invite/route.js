import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentProfile, isOwnerOrSuperAdmin } from '@/lib/api-auth';
import {
  invitationRedirectUrl,
  sendGizOpsInvitation,
} from '@/lib/invite-email';

export const dynamic = 'force-dynamic';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError) return Response.json({ error: authError }, { status: 401 });
    if (!isOwnerOrSuperAdmin(profile)) {
      return Response.json({ error: 'Only owners and super admins can invite team members.' }, { status: 403 });
    }

    const { email, full_name, role, account_id } = await req.json();
    const cleanEmail = clean(email).toLowerCase();
    const cleanName = clean(full_name);
    const targetAccountId = profile.role === 'super_admin' ? (account_id ?? profile.account_id) : profile.account_id;

    if (!cleanEmail || !cleanName || !role) {
      return Response.json({ error: 'email, full_name, and role are required.' }, { status: 400 });
    }

    if (!isEmail(cleanEmail)) {
      return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    if (!targetAccountId) {
      return Response.json({ error: 'A company account is required before inviting users.' }, { status: 400 });
    }

    if (profile.role === 'owner' && !['manager', 'staff'].includes(role)) {
      return Response.json({ error: 'Owners can invite managers and staff only.' }, { status: 403 });
    }

    if (profile.role === 'super_admin' && !['owner', 'manager', 'staff', 'super_admin'].includes(role)) {
      return Response.json({ error: 'Invalid role.' }, { status: 400 });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('name, is_active')
      .eq('id', targetAccountId)
      .single();

    if (accountError || !account) {
      return Response.json({ error: 'Company account was not found.' }, { status: 404 });
    }
    if (!account.is_active) {
      return Response.json({ error: 'Company account is inactive.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: cleanEmail,
      options: {
        data: {
          full_name: cleanName,
          role,
          account_id: targetAccountId,
          company_name: account.name,
        },
        redirectTo: invitationRedirectUrl(req),
      },
    });

    if (error) return Response.json({ error: error.message }, { status: 400 });

    const invitedUser = data?.user;
    const invitationLink = data?.properties?.action_link;
    if (!invitedUser?.id || !invitationLink) {
      return Response.json({ error: 'The secure invitation link could not be generated.' }, { status: 500 });
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: invitedUser.id,
      full_name: cleanName,
      role,
      account_id: targetAccountId,
      is_active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(invitedUser.id);
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    try {
      await sendGizOpsInvitation({
        email: cleanEmail,
        fullName: cleanName,
        role,
        companyName: account.name,
        invitationLink,
      });
    } catch (emailError) {
      await supabaseAdmin.from('profiles').delete().eq('id', invitedUser.id);
      await supabaseAdmin.auth.admin.deleteUser(invitedUser.id);
      return Response.json(
        { error: emailError?.message || 'Invitation email could not be sent.' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      user: {
        id: invitedUser.id,
        email: cleanEmail,
        full_name: cleanName,
        role,
        account_id: targetAccountId,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || 'Failed to send invite.' },
      { status: 500 }
    );
  }
}
