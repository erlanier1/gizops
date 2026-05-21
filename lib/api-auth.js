import { createServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getCurrentProfile() {
  const supabase = createServerClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return { user: null, profile: null, error: 'Not authenticated.' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, account_id, is_active')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return { user: session.user, profile: null, error: 'Active profile was not found.' };
  }

  return { user: session.user, profile, error: null };
}

export function isSuperAdmin(profile) {
  return profile?.role === 'super_admin';
}

export function isOwnerOrSuperAdmin(profile) {
  return profile?.role === 'owner' || profile?.role === 'super_admin';
}
