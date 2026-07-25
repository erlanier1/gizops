import { createPayPalOrder, makePaymentContext } from '@/lib/paypal';

export async function POST(req) {
  try {
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

    const order = await createPayPalOrder({
      amount: amount / 100,
      description: `Catering Deposit - ${eventType}${eventDate ? ` (${eventDate})` : ''}`,
      customId: makePaymentContext({ type: 'deposit', booking: bookingId }),
      returnTo: '/checkout',
    });

    return Response.json({ orderId: order.id, sessionId: order.id, url: order.url });
  } catch (error) {
    console.error('PayPal order error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
