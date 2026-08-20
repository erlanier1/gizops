import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile, isOwnerOrSuperAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashStaffSecret } from '@/lib/staff-auth';

async function actor(req: NextRequest) {
  const auth = await getCurrentProfile();
  if (auth.error || !isOwnerOrSuperAdmin(auth.profile)) return { error: NextResponse.json({ error: 'Owner access required.' }, { status: auth.error ? 401 : 403 }) };
  const requested = req.nextUrl.searchParams.get('account_id');
  return { profile: auth.profile!, accountId: auth.profile!.role === 'super_admin' ? requested || auth.profile!.account_id : auth.profile!.account_id };
}

export async function GET(req: NextRequest) {
  const auth = await actor(req); if (auth.error) return auth.error;
  const [{ data: employees }, { data: locations }, { data: events }] = await Promise.all([
    supabaseAdmin.from('staff_employees').select('id,employee_code,full_name,email,mobile,role,location_id,must_set_pin,failed_attempts,locked_until,is_active,created_at').eq('account_id', auth.accountId).order('full_name'),
    supabaseAdmin.from('staff_locations').select('*').eq('account_id', auth.accountId).order('name'),
    supabaseAdmin.from('staff_events').select('*').eq('account_id', auth.accountId).order('starts_at', { ascending: false }).limit(50),
  ]);
  return NextResponse.json({ employees: employees ?? [], locations: locations ?? [], events: events ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await actor(req); if (auth.error) return auth.error;
  const body = await req.json();
  if (body.resource === 'location') {
    const name = body.name?.trim();
    const type = body.type;
    if (!auth.accountId || !name || !['restaurant', 'food_truck'].includes(type)) return NextResponse.json({ error: 'Location name and type are required.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('staff_locations').insert({ account_id: auth.accountId, name, type }).select('id,name,type,is_active').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await supabaseAdmin.from('staff_audit_log').insert({ account_id: auth.accountId, actor_profile_id: auth.profile!.id, action: 'staff_location_created', details: { location_id: data.id, name, type } });
    return NextResponse.json({ success: true, location: data });
  }
  if (!auth.accountId || !body.employee_code?.trim() || !body.full_name?.trim() || !body.temporary_password || body.temporary_password.length < 8) return NextResponse.json({ error: 'Employee ID, name, and a temporary password of at least 8 characters are required.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('staff_employees').insert({ account_id: auth.accountId, employee_code: body.employee_code.trim(), full_name: body.full_name.trim(), email: body.email?.trim() || null, mobile: body.mobile?.trim() || null, role: body.role || 'staff', location_id: body.location_id || null, password_hash: hashStaffSecret(body.temporary_password), must_set_pin: true }).select('id,employee_code,full_name,role,must_set_pin,is_active').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'That employee ID is already in use.' : error.message }, { status: 400 });
  await supabaseAdmin.from('staff_audit_log').insert({ account_id: auth.accountId, employee_id: data.id, actor_profile_id: auth.profile!.id, action: 'employee_created' });
  return NextResponse.json({ success: true, employee: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await actor(req); if (auth.error) return auth.error;
  const body = await req.json();
  const { data: employee } = await supabaseAdmin.from('staff_employees').select('id,credential_version').eq('id', body.employee_id).eq('account_id', auth.accountId).maybeSingle();
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
  const update: any = { failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() };
  let action = 'account_unlocked';
  if (body.temporary_password) { if (body.temporary_password.length < 8) return NextResponse.json({ error: 'Temporary password must be at least 8 characters.' }, { status: 400 }); update.password_hash = hashStaffSecret(body.temporary_password); update.pin_hash = null; update.must_set_pin = true; action = 'temporary_password_reset'; }
  if (body.new_pin) { if (!/^\d{6}$/.test(body.new_pin)) return NextResponse.json({ error: 'PIN must be exactly 6 digits.' }, { status: 400 }); update.pin_hash = hashStaffSecret(body.new_pin); update.password_hash = null; update.must_set_pin = false; action = 'pin_reset'; }
  if (body.temporary_password || body.new_pin) update.credential_version = employee.credential_version + 1;
  if (typeof body.is_active === 'boolean') { update.is_active = body.is_active; action = body.is_active ? 'employee_activated' : 'employee_deactivated'; }
  await supabaseAdmin.from('staff_employees').update(update).eq('id', employee.id).eq('account_id', auth.accountId);
  await supabaseAdmin.from('staff_audit_log').insert({ account_id: auth.accountId, employee_id: employee.id, actor_profile_id: auth.profile!.id, action });
  return NextResponse.json({ success: true });
}
