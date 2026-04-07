import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED_ROLES = ['owner', 'super_admin'];

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (!caller || !ALLOWED_ROLES.includes(caller.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (params.id === session.user.id)
    return NextResponse.json({ error: 'You cannot remove yourself.' }, { status: 400 });

  // Delete profile first (FK references auth.users)
  await supabaseAdmin.from('profiles').delete().eq('id', params.id);

  // Delete auth user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
