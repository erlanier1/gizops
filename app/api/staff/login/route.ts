import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createStaffToken, hashStaffSecret, staffCookieOptions, STAFF_COOKIE, verifyStaffSecret } from '@/lib/staff-auth';

const LOCK_MINUTES = 15;
const MAX_FAILURES = 5;
const clean = (v: unknown) => typeof v === 'string' ? v.trim() : '';

async function audit(req: NextRequest, employee: any, action: string, success: boolean, details = {}) {
  await supabaseAdmin.from('staff_audit_log').insert({ account_id: employee?.account_id ?? null, employee_id: employee?.id ?? null, action, success, ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, user_agent: req.headers.get('user-agent'), details });
}

async function createManagerAppAccess(employee: any) {
  if (employee.role !== 'manager' || !employee.email) return null;
  const email = employee.email.toLowerCase();
  const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = usersData?.users?.find(item => item.email?.toLowerCase() === email);
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('id', user.id).eq('account_id', employee.account_id).eq('role', 'manager').eq('is_active', true).maybeSingle();
  if (!profile) return null;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: employee.email });
  if (error || !data?.properties?.hashed_token) return null;
  return data.properties.hashed_token;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const accountId = clean(body.account_id), code = clean(body.employee_code), credential = clean(body.credential);
  if (!accountId || !code || !credential) return NextResponse.json({ error: 'Company, employee ID, and PIN or password are required.' }, { status: 400 });
  const { data: employee } = await supabaseAdmin.from('staff_employees').select('*').eq('account_id', accountId).eq('employee_code', code).eq('is_active', true).maybeSingle();
  if (!employee) return NextResponse.json({ error: 'Invalid employee ID or credential.' }, { status: 401 });
  if (employee.locked_until && new Date(employee.locked_until) > new Date()) {
    await audit(req, employee, 'login_locked', false);
    return NextResponse.json({ error: 'Account temporarily locked. Ask a manager or try again later.' }, { status: 423 });
  }
  const usingPassword = employee.must_set_pin;
  const valid = verifyStaffSecret(credential, usingPassword ? employee.password_hash : employee.pin_hash);
  if (!valid) {
    const failures = employee.failed_attempts + 1;
    await supabaseAdmin.from('staff_employees').update({ failed_attempts: failures, locked_until: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null }).eq('id', employee.id);
    await audit(req, employee, 'login_failed', false, { attempt: failures });
    return NextResponse.json({ error: failures >= MAX_FAILURES ? 'Account locked for 15 minutes.' : 'Invalid employee ID or credential.', attempts_remaining: Math.max(0, MAX_FAILURES - failures) }, { status: 401 });
  }
  const device = body.trusted_device && ['restaurant','food_truck'].includes(body.work_type) ? 'trusted' : 'personal';
  const { token, maxAge } = createStaffToken({ employeeId: employee.id, accountId, role: employee.role, credentialVersion: employee.credential_version, locationId: body.location_id || null, eventId: body.event_id || null, device });
  await supabaseAdmin.from('staff_employees').update({ failed_attempts: 0, locked_until: null }).eq('id', employee.id);
  await audit(req, employee, 'login_succeeded', true, { device, work_type: body.work_type });
  if (!employee.must_set_pin) {
    const { data: open } = await supabaseAdmin.from('staff_time_entries').select('id').eq('employee_id', employee.id).is('clocked_out_at', null).limit(1).maybeSingle();
    if (!open) await supabaseAdmin.from('staff_time_entries').insert({ account_id: accountId, employee_id: employee.id, location_id: body.location_id || null, event_id: body.event_id || null, device_type: device });
  }
  const appTokenHash = employee.must_set_pin ? null : await createManagerAppAccess(employee);
  const response = NextResponse.json({ success: true, must_set_pin: employee.must_set_pin, app_token_hash: appTokenHash, employee: { id: employee.id, full_name: employee.full_name, role: employee.role } });
  response.cookies.set(STAFF_COOKIE, token, staffCookieOptions(maxAge));
  return response;
}

export async function PUT(req: NextRequest) {
  const { getStaffSession } = await import('@/lib/staff-auth');
  const session = getStaffSession();
  if (!session) return NextResponse.json({ error: 'Session expired.' }, { status: 401 });
  const { pin, current_pin: currentPin } = await req.json();
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 });
  const { data: employee } = await supabaseAdmin.from('staff_employees').select('id,account_id,email,role,pin_hash,must_set_pin,is_active,credential_version').eq('id', session.employeeId).eq('account_id', session.accountId).maybeSingle();
  if (!employee?.is_active || employee.credential_version !== session.credentialVersion) return NextResponse.json({ error: 'Session is no longer valid.' }, { status: 401 });
  if (!employee.must_set_pin && !verifyStaffSecret(clean(currentPin), employee.pin_hash)) {
    await supabaseAdmin.from('staff_audit_log').insert({ account_id: session.accountId, employee_id: session.employeeId, action: 'pin_change_failed', success: false });
    return NextResponse.json({ error: 'Current PIN is incorrect.' }, { status: 401 });
  }
  if (!employee.must_set_pin && verifyStaffSecret(pin, employee.pin_hash)) return NextResponse.json({ error: 'Choose a different PIN.' }, { status: 400 });
  const action = employee.must_set_pin ? 'pin_created' : 'pin_changed';
  const { error } = await supabaseAdmin.from('staff_employees').update({ pin_hash: hashStaffSecret(pin), password_hash: null, must_set_pin: false, updated_at: new Date().toISOString() }).eq('id', session.employeeId).eq('account_id', session.accountId);
  if (error) return NextResponse.json({ error: 'PIN could not be saved.' }, { status: 500 });
  await supabaseAdmin.from('staff_audit_log').insert({ account_id: session.accountId, employee_id: session.employeeId, action, success: true });
  const { data: open } = await supabaseAdmin.from('staff_time_entries').select('id').eq('employee_id', session.employeeId).is('clocked_out_at', null).limit(1).maybeSingle();
  if (!open) await supabaseAdmin.from('staff_time_entries').insert({ account_id: session.accountId, employee_id: session.employeeId, location_id: session.locationId, event_id: session.eventId, device_type: session.device });
  return NextResponse.json({ success: true, app_token_hash: await createManagerAppAccess(employee) });
}
