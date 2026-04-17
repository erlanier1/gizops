import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(req) {
  try {
    // Fetch menu items from Supabase
    const { data, error } = await supabase
      .from('pos_menu_items')
      .select('id, name, price, category')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      // Return fallback menu
      return Response.json([
        { id: 1, name: 'Tacos (3)', price: 12.00, category: 'Entrees' },
        { id: 2, name: 'Burrito', price: 10.00, category: 'Entrees' },
        { id: 3, name: 'Quesadilla', price: 9.00, category: 'Entrees' },
        { id: 4, name: 'Rice & Beans', price: 5.00, category: 'Sides' },
        { id: 5, name: 'Agua Fresca', price: 3.00, category: 'Drinks' },
        { id: 6, name: 'Churros (3)', price: 5.00, category: 'Desserts' },
      ]);
    }

    return Response.json(data || []);
  } catch (error) {
    console.error('API error:', error);
    return Response.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}
