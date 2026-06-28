import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function DELETE(_req, { params }) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError) return Response.json({ error: authError }, { status: 401 });
    if (!isSuperAdmin(profile)) {
      return Response.json({ error: 'Only super admins can delete companies.' }, { status: 403 });
    }

    const accountId = params.accountId;
    if (!accountId) {
      return Response.json({ error: 'accountId is required.' }, { status: 400 });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, name')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return Response.json({ error: 'Company account was not found.' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, deletedCompany: account.name });
  } catch (error) {
    return Response.json(
      { error: error?.message || 'Company could not be deleted.' },
      { status: 500 }
    );
  }
}
