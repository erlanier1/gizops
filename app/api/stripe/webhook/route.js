import { supabaseAdmin } from '@/lib/supabase-admin';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

async function markBookingDepositPaid(bookingId) {
  if (!bookingId) return;

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({
      deposit_paid: true,
      status: 'confirmed',
    })
    .eq('id', bookingId);

  if (error) {
    console.error('Failed to update booking after Stripe payment:', error);
  }
}

async function markMealPrepDepositPaid(mealPrepClientId, checkoutSessionId) {
  if (!mealPrepClientId) return;

  const { error } = await supabaseAdmin
    .from('meal_prep_clients')
    .update({
      payment_status: 'deposit_paid',
      stripe_checkout_session_id: checkoutSessionId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', mealPrepClientId);

  if (error) {
    console.error('Failed to update meal prep client after Stripe payment:', error);
  }
}

async function deductInventoryForPosOrder(posOrderId) {
  const { data: order } = await supabaseAdmin
    .from('pos_orders')
    .select('id, inventory_deducted')
    .eq('id', posOrderId)
    .single();

  if (!order || order.inventory_deducted) return;

  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from('pos_order_items')
    .select('pos_menu_item_id, quantity')
    .eq('pos_order_id', posOrderId);

  if (orderItemsError || !orderItems?.length) {
    console.error('Failed to load POS order items for inventory deduction:', orderItemsError);
    return;
  }

  const menuItemIds = [...new Set(orderItems.map(item => item.pos_menu_item_id).filter(Boolean))];
  if (menuItemIds.length === 0) return;

  const { data: recipes, error: recipeError } = await supabaseAdmin
    .from('pos_menu_item_ingredients')
    .select('pos_menu_item_id, inventory_item_id, quantity_per_item')
    .in('pos_menu_item_id', menuItemIds);

  if (recipeError || !recipes?.length) {
    console.error('No POS recipe mappings found for inventory deduction:', recipeError);
    return;
  }

  const deductions = new Map();

  for (const orderItem of orderItems) {
    const itemRecipes = recipes.filter(recipe => recipe.pos_menu_item_id === orderItem.pos_menu_item_id);
    for (const recipe of itemRecipes) {
      const current = deductions.get(recipe.inventory_item_id) ?? 0;
      deductions.set(recipe.inventory_item_id, current + Number(orderItem.quantity) * Number(recipe.quantity_per_item));
    }
  }

  for (const [inventoryItemId, deduction] of deductions.entries()) {
    const { data: inventoryItem, error: inventoryError } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_on_hand')
      .eq('id', inventoryItemId)
      .single();

    if (inventoryError || !inventoryItem) {
      console.error('Failed to load inventory item for POS deduction:', inventoryError);
      continue;
    }

    await supabaseAdmin
      .from('inventory_items')
      .update({
        quantity_on_hand: Math.max(0, Number(inventoryItem.quantity_on_hand) - deduction),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryItemId);
  }

  await supabaseAdmin
    .from('pos_orders')
    .update({ inventory_deducted: true, updated_at: new Date().toISOString() })
    .eq('id', posOrderId);
}

async function markPosOrderPaid(posOrderId, checkoutSessionId) {
  if (!posOrderId) return;

  const { error } = await supabaseAdmin
    .from('pos_orders')
    .update({
      status: 'paid',
      stripe_checkout_session_id: checkoutSessionId ?? null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', posOrderId);

  if (error) {
    console.error('Failed to update POS order after Stripe payment:', error);
    return;
  }

  await deductInventoryForPosOrder(posOrderId);
}

export async function POST(req) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return Response.json(
      { error: 'Missing STRIPE_WEBHOOK_SECRET environment variable.' },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return Response.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await markBookingDepositPaid(session.metadata?.bookingId);
      await markMealPrepDepositPaid(session.metadata?.mealPrepClientId, session.id);
      await markPosOrderPaid(session.metadata?.posOrderId, session.id);
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      await markBookingDepositPaid(invoice.metadata?.bookingId);
      await markMealPrepDepositPaid(invoice.metadata?.mealPrepClientId, invoice.id);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handling failed:', error);
    return Response.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }
}
