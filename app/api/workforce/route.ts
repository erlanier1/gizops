import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const allowedRoles = ['owner', 'manager', 'super_admin'];

async function actor(req: NextRequest) {
  const auth = await getCurrentProfile();
  if (auth.error || !auth.profile || !allowedRoles.includes(auth.profile.role)) return { error: NextResponse.json({ error: 'Manager access required.' }, { status: auth.error ? 401 : 403 }) };
  const requested = req.nextUrl.searchParams.get('account_id');
  const accountId = auth.profile.role === 'super_admin' ? requested || auth.profile.account_id : auth.profile.account_id;
  if (!accountId) return { error: NextResponse.json({ error: 'Select a company workspace.' }, { status: 400 }) };
  return { profile: auth.profile, accountId };
}

export async function GET(req: NextRequest) {
  const auth = await actor(req); if (auth.error) return auth.error;
  const start = req.nextUrl.searchParams.get('start') || new Date().toISOString().slice(0, 10);
  const end = req.nextUrl.searchParams.get('end') || start;
  const from = `${start}T00:00:00.000Z`, to = `${end}T23:59:59.999Z`;
  const [employees, locations, schedules, entries] = await Promise.all([
    supabaseAdmin.from('staff_employees').select('id,full_name,employee_code,role').eq('account_id', auth.accountId).eq('is_active', true).order('full_name'),
    supabaseAdmin.from('staff_locations').select('id,name,type').eq('account_id', auth.accountId).eq('is_active', true).order('name'),
    supabaseAdmin.from('staff_schedules').select('id,employee_id,location_id,starts_at,ends_at,notes').eq('account_id', auth.accountId).gte('starts_at', from).lte('starts_at', to).order('starts_at'),
    supabaseAdmin.from('staff_time_entries').select('id,employee_id,location_id,clocked_in_at,clocked_out_at,approval_status,approved_at,manager_note').eq('account_id', auth.accountId).gte('clocked_in_at', from).lte('clocked_in_at', to).order('clocked_in_at'),
  ]);
  return NextResponse.json({ employees: employees.data ?? [], locations: locations.data ?? [], schedules: schedules.data ?? [], entries: entries.data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await actor(req); if (auth.error) return auth.error;
  const body = await req.json();
  if (!body.employee_id || !body.starts_at || !body.ends_at || new Date(body.ends_at) <= new Date(body.starts_at)) return NextResponse.json({ error: 'Employee, start time, and a valid end time are required.' }, { status: 400 });
  const { data: employee } = await supabaseAdmin.from('staff_employees').select('id').eq('id', body.employee_id).eq('account_id', auth.accountId).eq('is_active', true).maybeSingle();
  if (!employee) return NextResponse.json({ error: 'Employee was not found.' }, { status: 404 });
  const { data, error } = await supabaseAdmin.from('staff_schedules').insert({ account_id: auth.accountId, employee_id: body.employee_id, location_id: body.location_id || null, starts_at: body.starts_at, ends_at: body.ends_at, notes: body.notes?.trim() || null, created_by: auth.profile.id }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabaseAdmin.from('staff_audit_log').insert({ account_id: auth.accountId, actor_profile_id: auth.profile.id, employee_id: body.employee_id, action: 'shift_scheduled', details: { schedule_id: data.id, starts_at: body.starts_at, ends_at: body.ends_at } });
  return NextResponse.json({ success: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const auth = await actor(req); if (auth.error) return auth.error;
  const body = await req.json();
  const ids = Array.isArray(body.entry_ids) ? body.entry_ids.filter((id: unknown) => typeof id === 'string') : [];
  if (!ids.length || !['approved', 'rejected', 'pending'].includes(body.status)) return NextResponse.json({ error: 'Select time entries and a valid status.' }, { status: 400 });
  const update = { approval_status: body.status, approved_by: body.status === 'pending' ? null : auth.profile.id, approved_at: body.status === 'pending' ? null : new Date().toISOString(), manager_note: body.note?.trim() || null };
  const { data, error } = await supabaseAdmin.from('staff_time_entries').update(update).in('id', ids).eq('account_id', auth.accountId).not('clocked_out_at', 'is', null).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabaseAdmin.from('staff_audit_log').insert({ account_id: auth.accountId, actor_profile_id: auth.profile.id, action: 'timesheets_reviewed', details: { status: body.status, entry_ids: data?.map(item => item.id) ?? [] } });
  return NextResponse.json({ success: true, updated: data?.length ?? 0 });
}
