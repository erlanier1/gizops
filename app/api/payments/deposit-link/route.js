import { createPayPalOrder, makePaymentContext } from '@/lib/paypal';

export async function POST(req) {
  try {
    const {
      bookingId,
      mealPrepClientId,
      clientName,
      email,
      eventDate,
      eventType = 'meal_prep',
      amount,
      description,
    } = await req.json();

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
      customId: makePaymentContext({ type: 'deposit', booking: bookingId, meal: mealPrepClientId }),
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
