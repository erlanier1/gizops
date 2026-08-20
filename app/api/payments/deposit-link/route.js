import { createPayPalOrder, makePaymentContext } from '@/lib/paypal';
import { getCurrentProfile, isSuperAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req) {
  try {
    const { profile, error: authError } = await getCurrentProfile();
    if (authError || !profile) return Response.json({ error: 'Not authenticated.' }, { status: 401 });
    if (!['owner', 'manager', 'super_admin'].includes(profile.role)) return Response.json({ error: 'You do not have permission to create payment links.' }, { status: 403 });
    const {
      accountId,
      bookingId,
      mealPrepClientId,
      clientName,
      email,
      eventDate,
      eventType = 'meal_prep',
      amount,
      description,
    } = await req.json();

    if (!accountId) return Response.json({ error: 'Select a company workspace first.' }, { status: 400 });
    if (!isSuperAdmin(profile) && profile.account_id !== accountId) return Response.json({ error: 'You cannot create payment links for another company.' }, { status: 403 });
    const { data: account } = await supabaseAdmin.from('accounts').select('id,is_active').eq('id', accountId).maybeSingle();
    if (!account?.is_active) return Response.json({ error: 'Company workspace was not found or is inactive.' }, { status: 404 });

    if (!clientName || !email || !amount) {
      return Response.json(
        { error: 'clientName, email, and amount are required.' },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(Number(amount) * 100);
    if (!Number.isInteger(amountInCents) || amountInCents < 100) {
      return Response.json(
        { error: 'amount must be at least 1.00.' },
        { status: 400 }
      );
    }

    const order = await createPayPalOrder({
      amount: amountInCents / 100,
      description: description || `${eventType.replace('_', ' ')} deposit${eventDate ? ` (${eventDate})` : ''}`,
      customId: makePaymentContext({ type: 'deposit', account: accountId, booking: bookingId, meal: mealPrepClientId }),
      returnTo: mealPrepClientId ? '/meal-prep/payments' : '/dashboard',
    });

    return Response.json({ url: order.url, orderId: order.id, sessionId: order.id });
  } catch (error) {
    console.error('PayPal deposit link error:', error);
    return Response.json(
      { error: error.message || 'Failed to create deposit payment link.' },
      { status: 500 }
    );
  }
}
