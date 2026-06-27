import { getCurrentProfile } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { user, error: authError } = await getCurrentProfile();
    if (authError || !user) {
      return Response.json({ error: authError || 'Not authenticated.' }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        password_change_required: false,
      })
      .eq('id', user.id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error?.message || 'Password change could not be completed.' },
      { status: 500 }
    );
  }
}
