import { getAppUrl, getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

function orderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `POS-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function POST(req) {
  try {
    const stripe = getStripe();
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
          payment_method: 'stripe_checkout',
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

    // Format line items for Stripe
    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${getAppUrl()}/pos?payment=success${posOrderId ? `&order=${posOrderId}` : ''}`,
      cancel_url: `${getAppUrl()}/pos?payment=cancelled`,
      metadata: {
        order_type: 'pos',
        posOrderId,
        orderSource,
        item_count: String(items.length),
      },
    });

    if (posOrderId) {
      await supabaseAdmin
        .from('pos_orders')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', posOrderId);
    }

    return Response.json({ sessionId: session.id, url: session.url, posOrderId, warning: databaseWarning });
  } catch (error) {
    console.error('Stripe error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
