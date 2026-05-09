import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req) {
  try {
    const { email, full_name, role } = await req.json();

    if (!email || !full_name || !role) {
      return Response.json({ error: 'email, full_name, and role are required.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role },
    });

    if (error) return Response.json({ error: error.message }, { status: 400 });

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      full_name,
      role,
      is_active: true,
    });

    if (profileError) return Response.json({ error: profileError.message }, { status: 500 });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to send invite.' }, { status: 500 });
  }
}
