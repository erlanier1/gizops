import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const managerRoles = ['owner', 'manager', 'super_admin'];

function resolveAccountId(profile, requestedAccountId) {
  return isSuperAdmin(profile) ? requestedAccountId : profile.account_id;
}

function validateMenuItem(body) {
  const name = String(body?.name ?? '').trim();
  const category = String(body?.category ?? '').trim() || 'Entrees';
  const price = Number(body?.price);
  if (!name) return { error: 'Item name is required.' };
  if (!Number.isFinite(price) || price < 0) return { error: 'Enter a valid price of $0.00 or more.' };
  return { name, category, price: Math.round(price * 100) / 100 };
}

const fallbackMenu = [
  { id: 1, name: 'Tacos (3)', price: 12.00, category: 'Entrees' },
  { id: 2, name: 'Burrito', price: 10.00, category: 'Entrees' },
  { id: 3, name: 'Quesadilla', price: 9.00, category: 'Entrees' },
  { id: 4, name: 'Rice & Beans', price: 5.00, category: 'Sides' },
  { id: 5, name: 'Agua Fresca', price: 3.00, category: 'Drinks' },
  { id: 6, name: 'Churros (3)', price: 5.00, category: 'Desserts' },
];

export async function GET(req) {
  try {
    const auth = await getCurrentProfile();
    if (!auth.profile) return Response.json({ error: auth.error }, { status: 401 });
    const requestedAccountId = new URL(req.url).searchParams.get('accountId');
    const accountId = isSuperAdmin(auth.profile) ? requestedAccountId : auth.profile.account_id;
    if (!accountId) return Response.json([]);
    // Fetch menu items from Supabase
    const { data, error } = await supabaseAdmin
      .from('pos_menu_items')
      .select('id, name, price, category')
      .eq('account_id', accountId)
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return Response.json(fallbackMenu);
    }

    return Response.json(data ?? fallbackMenu);
  } catch (error) {
    console.error('API error:', error);
    return Response.json(fallbackMenu);
  }
}

export async function POST(req) {
  try {
    const auth = await getCurrentProfile();
    if (!auth.profile) return Response.json({ error: auth.error }, { status: 401 });
    if (!managerRoles.includes(auth.profile.role)) return Response.json({ error: 'You do not have permission to manage POS items.' }, { status: 403 });
    const body = await req.json();
    const accountId = resolveAccountId(auth.profile, body.accountId);
    if (!accountId) return Response.json({ error: 'Choose a company workspace first.' }, { status: 400 });
    const item = validateMenuItem(body);
    if (item.error) return Response.json({ error: item.error }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('pos_menu_items')
      .insert({ account_id: accountId, ...item, active: true, updated_at: new Date().toISOString() })
      .select('id, name, price, category').single();
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (error) {
    console.error('POS item create error:', error);
    return Response.json({ error: 'Could not add the menu item.' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const auth = await getCurrentProfile();
    if (!auth.profile) return Response.json({ error: auth.error }, { status: 401 });
    if (!managerRoles.includes(auth.profile.role)) return Response.json({ error: 'You do not have permission to manage POS items.' }, { status: 403 });
    const body = await req.json();
    const accountId = resolveAccountId(auth.profile, body.accountId);
    if (!accountId || !body.id) return Response.json({ error: 'Item and company are required.' }, { status: 400 });
    const item = validateMenuItem(body);
    if (item.error) return Response.json({ error: item.error }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('pos_menu_items')
      .update({ ...item, updated_at: new Date().toISOString() })
      .eq('id', body.id).eq('account_id', accountId).eq('active', true)
      .select('id, name, price, category').single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    console.error('POS item update error:', error);
    return Response.json({ error: 'Could not update the menu item.' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const auth = await getCurrentProfile();
    if (!auth.profile) return Response.json({ error: auth.error }, { status: 401 });
    if (!managerRoles.includes(auth.profile.role)) return Response.json({ error: 'You do not have permission to manage POS items.' }, { status: 403 });
    const body = await req.json();
    const accountId = resolveAccountId(auth.profile, body.accountId);
    if (!accountId || !body.id) return Response.json({ error: 'Item and company are required.' }, { status: 400 });
    const { error } = await supabaseAdmin.from('pos_menu_items')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', body.id).eq('account_id', accountId);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    console.error('POS item remove error:', error);
    return Response.json({ error: 'Could not remove the menu item.' }, { status: 500 });
  }
}
