import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError) return Response.json({ error: authError }, { status: 401 });

    let profilesQuery = supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, account_id, is_active');

    if (isSuperAdmin(profile)) {
      const selectedAccountId = new URL(req.url).searchParams.get('account_id');
      if (!selectedAccountId) {
        return Response.json({ error: 'Select a company workspace to view its team.' }, { status: 400 });
      }

      const { data: account, error: accountError } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('id', selectedAccountId)
        .single();

      if (accountError || !account) {
        return Response.json({ error: 'Company account was not found.' }, { status: 404 });
      }

      profilesQuery = profilesQuery.eq('account_id', selectedAccountId);
    } else {
      if (!profile.account_id) return Response.json([]);
      profilesQuery = profilesQuery.eq('account_id', profile.account_id);
    }

    const [{ data: profiles, error: profilesError }, { data: { users }, error: usersError }] = await Promise.all([
      profilesQuery,
      supabaseAdmin.auth.admin.listUsers(),
    ]);

    if (profilesError) return Response.json({ error: profilesError.message }, { status: 500 });
    if (usersError) return Response.json({ error: usersError.message }, { status: 500 });

    const usersMap = new Map(users.map(u => [u.id, u]));

    const members = profiles.map(p => {
      const authUser = usersMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        email: authUser?.email ?? null,
        role: p.role,
        account_id: p.account_id,
        is_active: p.is_active,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        invited_at: authUser?.invited_at ?? null,
        email_confirmed_at: authUser?.email_confirmed_at ?? null,
      };
    });

    return Response.json(members);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch team members.' }, { status: 500 });
  }
}
