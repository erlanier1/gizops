const PAYPAL_API_URLS = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

let cachedToken = null;

function getPayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const environment = process.env.PAYPAL_ENVIRONMENT === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable.');
  }

  return { clientId, clientSecret, baseUrl: PAYPAL_API_URLS[environment] };
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const { clientId, clientSecret, baseUrl } = getPayPalConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error_description || body.error || 'PayPal authentication failed.');
  }

  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Number(body.expires_in || 300) * 1000,
  };
  return cachedToken.value;
}

export async function paypalRequest(path, options = {}) {
  const { baseUrl } = getPayPalConfig();
  const accessToken = await getAccessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    cache: 'no-store',
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = body?.details?.[0]?.description || body?.message || 'PayPal request failed.';
    throw new Error(detail);
  }

  return body;
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function makePaymentContext(values) {
  const context = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) context.set(key, String(value));
  });
  return context.toString();
}

export function parsePaymentContext(value = '') {
  return Object.fromEntries(new URLSearchParams(value));
}

export async function createPayPalOrder({ amount, description, customId, returnTo, items }) {
  const appUrl = getAppUrl();
  const captureUrl = new URL('/api/paypal/capture', appUrl);
  captureUrl.searchParams.set('returnTo', returnTo);

  const purchaseUnit = {
    amount: {
      currency_code: 'USD',
      value: Number(amount).toFixed(2),
    },
    description: String(description || 'GizOps payment').slice(0, 127),
    custom_id: String(customId || '').slice(0, 127),
  };

  if (items?.length) {
    purchaseUnit.items = items.map(item => ({
      name: String(item.name).slice(0, 127),
      quantity: String(item.quantity),
      unit_amount: {
        currency_code: 'USD',
        value: Number(item.unitAmount).toFixed(2),
      },
    }));
    purchaseUnit.amount.breakdown = {
      item_total: { currency_code: 'USD', value: Number(amount).toFixed(2) },
    };
  }

  const order = await paypalRequest('/v2/checkout/orders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [purchaseUnit],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: process.env.PAYPAL_BRAND_NAME || 'GizOps',
            user_action: 'PAY_NOW',
            return_url: captureUrl.toString(),
            cancel_url: new URL(returnTo.includes('?') ? `${returnTo}&payment=cancelled` : `${returnTo}?payment=cancelled`, appUrl).toString(),
          },
        },
      },
    }),
  });

  return {
    id: order.id,
    url: order.links?.find(link => link.rel === 'payer-action' || link.rel === 'approve')?.href,
  };
}

export async function capturePayPalOrder(orderId) {
  return paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { Prefer: 'return=representation', 'PayPal-Request-Id': `capture-${orderId}` },
  });
}

export async function verifyPayPalWebhook({ headers, event }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error('Missing PAYPAL_WEBHOOK_ID environment variable.');

  const verification = await paypalRequest('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });

  return verification?.verification_status === 'SUCCESS';
}
