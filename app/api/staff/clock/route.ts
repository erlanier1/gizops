import { NextRequest, NextResponse } from 'next/server';
import { getStaffSession } from '@/lib/staff-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const session = getStaffSession();
  if (!session) return NextResponse.json({ error: 'Session expired.' }, { status: 401 });
  const { data: employee } = await supabaseAdmin.from('staff_employees').select('is_active,credential_version').eq('id', session.employeeId).eq('account_id', session.accountId).maybeSingle();
  if (!employee?.is_active || employee.credential_version !== session.credentialVersion) return NextResponse.json({ error: 'Session is no longer valid.' }, { status: 401 });
  const { action } = await req.json();
  const { data: open } = await supabaseAdmin.from('staff_time_entries').select('id').eq('employee_id', session.employeeId).is('clocked_out_at', null).order('clocked_in_at', { ascending: false }).limit(1).maybeSingle();
  if (action === 'in') {
    if (open) return NextResponse.json({ error: 'You are already clocked in.' }, { status: 409 });
    const { data, error } = await supabaseAdmin.from('staff_time_entries').insert({ account_id: session.accountId, employee_id: session.employeeId, location_id: session.locationId, event_id: session.eventId, device_type: session.device }).select('id,clocked_in_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabaseAdmin.from('staff_audit_log').insert({ account_id: session.accountId, employee_id: session.employeeId, action: 'clock_in', details: { location_id: session.locationId, event_id: session.eventId } });
    return NextResponse.json({ success: true, entry: data });
  }
  if (action === 'out') {
    if (!open) return NextResponse.json({ error: 'No open shift was found.' }, { status: 409 });
    await supabaseAdmin.from('staff_time_entries').update({ clocked_out_at: new Date().toISOString() }).eq('id', open.id).eq('account_id', session.accountId);
    await supabaseAdmin.from('staff_audit_log').insert({ account_id: session.accountId, employee_id: session.employeeId, action: 'clock_out' });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
