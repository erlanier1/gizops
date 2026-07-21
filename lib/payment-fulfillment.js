import { supabaseAdmin } from '@/lib/supabase-admin';

export async function markBookingDepositPaid(bookingId) {
  if (!bookingId) return;
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ deposit_paid: true, status: 'confirmed' })
    .eq('id', bookingId);
  if (error) throw error;
}

export async function markMealPrepDepositPaid(mealPrepClientId, paypalOrderId) {
  if (!mealPrepClientId) return;
  const { error } = await supabaseAdmin
    .from('meal_prep_clients')
    .update({
      payment_status: 'deposit_paid',
      paypal_order_id: paypalOrderId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', mealPrepClientId);
  if (error) throw error;
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
  if (orderItemsError || !orderItems?.length) throw orderItemsError || new Error('No POS order items found.');

  const menuItemIds = [...new Set(orderItems.map(item => item.pos_menu_item_id).filter(Boolean))];
  if (!menuItemIds.length) return;

  const { data: recipes, error: recipeError } = await supabaseAdmin
    .from('pos_menu_item_ingredients')
    .select('pos_menu_item_id, inventory_item_id, quantity_per_item')
    .in('pos_menu_item_id', menuItemIds);
  if (recipeError) throw recipeError;
  if (!recipes?.length) return;

  const deductions = new Map();
  for (const orderItem of orderItems) {
    for (const recipe of recipes.filter(item => item.pos_menu_item_id === orderItem.pos_menu_item_id)) {
      deductions.set(
        recipe.inventory_item_id,
        (deductions.get(recipe.inventory_item_id) || 0) + Number(orderItem.quantity) * Number(recipe.quantity_per_item),
      );
    }
  }

  for (const [inventoryItemId, deduction] of deductions) {
    const { data: inventoryItem } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_on_hand')
      .eq('id', inventoryItemId)
      .single();
    if (!inventoryItem) continue;
    await supabaseAdmin
      .from('inventory_items')
      .update({ quantity_on_hand: Math.max(0, Number(inventoryItem.quantity_on_hand) - deduction), updated_at: new Date().toISOString() })
      .eq('id', inventoryItemId);
  }

  await supabaseAdmin
    .from('pos_orders')
    .update({ inventory_deducted: true, updated_at: new Date().toISOString() })
    .eq('id', posOrderId);
}

export async function markPosOrderPaid(posOrderId, paypalOrderId) {
  if (!posOrderId) return;
  const { error } = await supabaseAdmin
    .from('pos_orders')
    .update({
      status: 'paid',
      paypal_order_id: paypalOrderId || null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', posOrderId);
  if (error) throw error;
  await deductInventoryForPosOrder(posOrderId);
}

export async function fulfillPayment(context, paypalOrderId) {
  await markBookingDepositPaid(context.booking);
  await markMealPrepDepositPaid(context.meal, paypalOrderId);
  await markPosOrderPaid(context.pos, paypalOrderId);
}
