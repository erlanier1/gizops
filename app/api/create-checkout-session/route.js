import { getAppUrl, getStripe } from '@/lib/stripe';

export async function POST(req) {
  try {
    const stripe = getStripe();
    const { clientName, email, eventDate, eventType, depositAmount, bookingId } = await req.json();

    if (!clientName || !email || !eventType || !depositAmount) {
      return Response.json(
        { error: 'clientName, email, eventType, and depositAmount are required.' },
        { status: 400 }
      );
    }

    const amount = Number(depositAmount);
    if (!Number.isInteger(amount) || amount < 100) {
      return Response.json(
        { error: 'depositAmount must be an amount in cents of at least 100.' },
        { status: 400 }
      );
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Catering Deposit - ${eventType}`,
              description: `Event on ${eventDate}`,
            },
            unit_amount: amount, // Already in cents from frontend
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      mode: 'payment',
      success_url: `${getAppUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getAppUrl()}/checkout/cancel`,
      metadata: {
        payment_type: 'deposit',
        bookingId: bookingId ?? '',
        clientName,
        eventDate,
        eventType,
      },
    });

    return Response.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe session error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
