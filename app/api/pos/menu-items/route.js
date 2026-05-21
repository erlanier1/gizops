import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

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
    // Fetch menu items from Supabase
    const { data, error } = await supabaseAdmin
      .from('pos_menu_items')
      .select('id, name, price, category')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return Response.json(fallbackMenu);
    }

    return Response.json(data?.length ? data : fallbackMenu);
  } catch (error) {
    console.error('API error:', error);
    return Response.json(fallbackMenu);
  }
}
