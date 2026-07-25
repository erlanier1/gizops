import { fulfillPayment } from '@/lib/payment-fulfillment';
import { parsePaymentContext, verifyPayPalWebhook } from '@/lib/paypal';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const event = await req.json();

  try {
    if (!(await verifyPayPalWebhook({ headers: req.headers, event }))) {
      return Response.json({ error: 'Invalid webhook signature.' }, { status: 400 });
    }

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const context = parsePaymentContext(event.resource?.custom_id);
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id || '';
      await fulfillPayment(context, orderId);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook handling failed:', error);
    return Response.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }
}
