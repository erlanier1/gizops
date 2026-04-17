import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { items, total } = await req.json();

    if (!items || items.length === 0 || !total) {
      return Response.json(
        { error: 'Invalid order data' },
        { status: 400 }
      );
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pos?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pos?payment=cancelled`,
      metadata: {
        order_type: 'pos',
        item_count: items.length,
      },
    });

    return Response.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
