import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED_ROLES = ['owner', 'super_admin'];
const INVITABLE_ROLES = ['manager', 'staff'];

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (!caller || !ALLOWED_ROLES.includes(caller.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, full_name, role } = await req.json();

  if (!email || !full_name || !role)
    return NextResponse.json({ error: 'email, full_name, and role are required.' }, { status: 400 });
  if (!INVITABLE_ROLES.includes(role))
    return NextResponse.json({ error: 'Invalid role. Only manager or staff can be invited.' }, { status: 400 });

  // Invite via Supabase Auth — sends magic-link email
  const { data, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
  });
  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 });

  // Upsert profile row (user may already have a partial record)
  const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
    id:        data.user.id,
    full_name,
    email,
    role,
    is_active: true,
  }, { onConflict: 'id' });
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
