import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const [{ data: profiles, error: profilesError }, { data: { users }, error: usersError }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, role, is_active'),
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
