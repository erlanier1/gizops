import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('account_id');
  if (!accountId) {
    const { data } = await supabaseAdmin.from('accounts').select('id,name').eq('is_active', true).order('name');
    return NextResponse.json({ accounts: data ?? [] });
  }
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [{ data: locations }, { data: events }] = await Promise.all([
    supabaseAdmin.from('staff_locations').select('id,name,type').eq('account_id', accountId).eq('is_active', true).order('name'),
    supabaseAdmin.from('staff_events').select('id,name,client,address,starts_at,status').eq('account_id', accountId).in('status', ['upcoming','active']).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'),
  ]);
  return NextResponse.json({ locations: locations ?? [], events: events ?? [] });
}
