import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req, { params }) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError) return Response.json({ error: authError }, { status: 401 });
    if (!isSuperAdmin(profile)) {
      return Response.json({ error: 'Only super admins can invite company owners.' }, { status: 403 });
    }

    const accountId = params.accountId;
    const { email, full_name } = await req.json();
    const cleanEmail = clean(email).toLowerCase();
    const cleanName = clean(full_name);

    if (!accountId || !cleanEmail || !cleanName) {
      return Response.json({ error: 'accountId, email, and full_name are required.' }, { status: 400 });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, is_active')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return Response.json({ error: 'Company account was not found.' }, { status: 404 });
    }

    if (!account.is_active) {
      return Response.json({ error: 'Company account is inactive.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
      data: {
        full_name: cleanName,
        role: 'owner',
        account_id: accountId,
        company_name: account.name,
      },
    });

    if (error) return Response.json({ error: error.message }, { status: 400 });

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      full_name: cleanName,
      role: 'owner',
      account_id: accountId,
      is_active: true,
    });

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 });
    }

    await supabaseAdmin
      .from('accounts')
      .update({
        owner_contact_name: cleanName,
        owner_contact_email: cleanEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    return Response.json({
      success: true,
      user: {
        id: data.user.id,
        email: cleanEmail,
        full_name: cleanName,
        role: 'owner',
        account_id: accountId,
      },
    });
  } catch (error) {
    return Response.json({ error: 'Failed to invite company owner.' }, { status: 500 });
  }
}
