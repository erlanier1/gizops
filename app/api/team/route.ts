import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED_ROLES = ['owner', 'super_admin'];

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (!caller || !ALLOWED_ROLES.includes(caller.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ data: profiles }, { data: { users } }] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: true }),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const merged = (profiles ?? []).map(p => {
    const authUser = users?.find(u => u.id === p.id);
    return {
      ...p,
      last_sign_in_at:    authUser?.last_sign_in_at    ?? null,
      invited_at:         authUser?.invited_at          ?? null,
      email_confirmed_at: authUser?.email_confirmed_at  ?? null,
    };
  });

  return NextResponse.json(merged);
}
