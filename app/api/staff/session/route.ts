import { NextResponse } from 'next/server';
import { getStaffSession, STAFF_COOKIE } from '@/lib/staff-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const session = getStaffSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const { data: employee } = await supabaseAdmin.from('staff_employees').select('id,full_name,employee_code,role,must_set_pin,is_active,credential_version').eq('id', session.employeeId).eq('account_id', session.accountId).maybeSingle();
  if (!employee?.is_active || employee.credential_version !== session.credentialVersion) return NextResponse.json({ error: 'Session is no longer valid.' }, { status: 401 });
  const { data: openEntry } = await supabaseAdmin.from('staff_time_entries').select('id,clocked_in_at').eq('employee_id', session.employeeId).is('clocked_out_at', null).order('clocked_in_at', { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({ session, employee, openEntry });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(STAFF_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
