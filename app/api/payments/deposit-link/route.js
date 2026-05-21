import { getAppUrl, getStripe } from '@/lib/stripe';

export async function POST(req) {
  try {
    const stripe = getStripe();
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: description || `${eventType.replace('_', ' ')} deposit`,
              description: eventDate ? `Scheduled for ${eventDate}` : undefined,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${getAppUrl()}/dashboard?payment=success`,
      cancel_url: `${getAppUrl()}/meal-prep/payments?payment=cancelled`,
      metadata: {
        payment_type: 'deposit',
        bookingId: bookingId ?? '',
        mealPrepClientId: mealPrepClientId ?? '',
        clientName,
        eventDate: eventDate ?? '',
        eventType,
      },
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Deposit payment link error:', error);
    return Response.json(
      { error: error.message || 'Failed to create deposit payment link.' },
      { status: 500 }
    );
  }
}
