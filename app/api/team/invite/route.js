import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentProfile, isOwnerOrSuperAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError) return Response.json({ error: authError }, { status: 401 });
    if (!isOwnerOrSuperAdmin(profile)) {
      return Response.json({ error: 'Only owners and super admins can invite team members.' }, { status: 403 });
    }

    const { email, full_name, role, account_id } = await req.json();
    const targetAccountId = profile.role === 'super_admin' ? (account_id ?? profile.account_id) : profile.account_id;

    if (!email || !full_name || !role) {
      return Response.json({ error: 'email, full_name, and role are required.' }, { status: 400 });
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

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role, account_id: targetAccountId },
    });

    if (error) return Response.json({ error: error.message }, { status: 400 });

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      full_name,
      role,
      account_id: targetAccountId,
      is_active: true,
    });

    if (profileError) return Response.json({ error: profileError.message }, { status: 500 });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to send invite.' }, { status: 500 });
  }
}
