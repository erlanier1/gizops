import { supabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(req, { params }) {
  try {
    const { id } = params;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return Response.json({ error: error.message }, { status: 400 });

    await supabaseAdmin.from('profiles').delete().eq('id', id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to remove user.' }, { status: 500 });
  }
}
