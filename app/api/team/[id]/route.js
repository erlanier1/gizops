import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentProfile, isOwnerOrSuperAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(req, { params }) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError) return Response.json({ error: authError }, { status: 401 });
    if (!isOwnerOrSuperAdmin(profile)) {
      return Response.json({ error: 'Only owners and super admins can remove users.' }, { status: 403 });
    }

    const { id } = params;
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, account_id')
      .eq('id', id)
      .single();

    if (targetError || !targetProfile) {
      return Response.json({ error: 'User profile was not found.' }, { status: 404 });
    }

    if (profile.role === 'owner') {
      if (targetProfile.account_id !== profile.account_id) {
        return Response.json({ error: 'You can remove users from your company only.' }, { status: 403 });
      }
      if (targetProfile.role === 'owner' || targetProfile.role === 'super_admin') {
        return Response.json({ error: 'Owners cannot remove owners or super admins.' }, { status: 403 });
      }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return Response.json({ error: error.message }, { status: 400 });

    await supabaseAdmin.from('profiles').delete().eq('id', id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to remove user.' }, { status: 500 });
  }
}
