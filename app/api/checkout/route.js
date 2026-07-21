import { createPayPalOrder, makePaymentContext } from '@/lib/paypal';
import { supabaseAdmin } from '@/lib/supabase-admin';

function orderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `POS-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function POST(req) {
  try {
    const { items, total, customerName = '', orderSource = 'food_truck' } = await req.json();

    if (!items || items.length === 0 || !total) {
      return Response.json(
        { error: 'Invalid order data' },
        { status: 400 }
      );
    }

    const totalInCents = Math.round(Number(total));
    const totalInDollars = totalInCents / 100;
    let posOrderId = '';
    let databaseWarning = '';

    try {
      const { data: order, error: orderError } = await supabaseAdmin
        .from('pos_orders')
        .insert({
          order_number: orderNumber(),
          customer_name: customerName || null,
          source: orderSource,
          status: 'checkout_pending',
          payment_method: 'paypal_checkout',
          subtotal: totalInDollars,
          total: totalInDollars,
        })
        .select()
        .single();

      if (orderError) throw orderError;
      posOrderId = order.id;

      const orderItems = items.map((item) => ({
        pos_order_id: order.id,
        pos_menu_item_id: String(item.id),
        item_name: item.name,
        unit_price: Number(item.price),
        quantity: Number(item.quantity),
        line_total: Number(item.price) * Number(item.quantity),
      }));

      const { error: itemError } = await supabaseAdmin
        .from('pos_order_items')
        .insert(orderItems);

      if (itemError) throw itemError;
    } catch (error) {
      databaseWarning = 'POS order could not be stored before checkout. Run the POS Supabase SQL setup to enable order history and inventory deductions.';
      console.error('POS order storage warning:', error);
    }

    const order = await createPayPalOrder({
      amount: totalInDollars,
      description: `GizOps POS order${customerName ? ` for ${customerName}` : ''}`,
      customId: makePaymentContext({ type: 'pos', pos: posOrderId }),
      returnTo: '/pos',
      items: items.map(item => ({ name: item.name, quantity: Number(item.quantity), unitAmount: Number(item.price) })),
    });

    if (posOrderId) {
      await supabaseAdmin
        .from('pos_orders')
        .update({ paypal_order_id: order.id })
        .eq('id', posOrderId);
    }

    return Response.json({ orderId: order.id, sessionId: order.id, url: order.url, posOrderId, warning: databaseWarning });
  } catch (error) {
    console.error('PayPal checkout error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
