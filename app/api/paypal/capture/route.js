import { NextResponse } from 'next/server';
import { capturePayPalOrder, getAppUrl, parsePaymentContext } from '@/lib/paypal';
import { fulfillPayment } from '@/lib/payment-fulfillment';

export const dynamic = 'force-dynamic';

function safeReturnPath(value) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

export async function GET(req) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('token');
  const returnTo = safeReturnPath(url.searchParams.get('returnTo'));

  if (!orderId) {
    return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}payment=failed`, getAppUrl()));
  }

  try {
    const order = await capturePayPalOrder(orderId);
    if (order.status !== 'COMPLETED') throw new Error(`Unexpected PayPal order status: ${order.status}`);
    const context = parsePaymentContext(order.purchase_units?.[0]?.custom_id);
    await fulfillPayment(context, order.id);

    const separator = returnTo.includes('?') ? '&' : '?';
    const destination = `${returnTo}${separator}payment=success${context.pos ? `&order=${encodeURIComponent(context.pos)}` : ''}`;
    return NextResponse.redirect(new URL(destination, getAppUrl()));
  } catch (error) {
    console.error('PayPal capture failed:', error);
    const separator = returnTo.includes('?') ? '&' : '?';
    return NextResponse.redirect(new URL(`${returnTo}${separator}payment=failed`, getAppUrl()));
  }
}
