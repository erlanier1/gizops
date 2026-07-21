# PayPal setup for GizOps

Start in PayPal Sandbox. Do not paste live secrets into chat, GitHub, or any source file.

## Values to collect

From the PayPal Developer Dashboard, create or select a REST app and collect:

1. **Client ID** -> `PAYPAL_CLIENT_ID`
2. **Client secret** -> `PAYPAL_CLIENT_SECRET`
3. **Webhook ID** -> `PAYPAL_WEBHOOK_ID`

Also configure:

- `PAYPAL_ENVIRONMENT=sandbox` during testing; change it to `live` only after a successful sandbox test.
- `PAYPAL_BRAND_NAME=GizOps` (or the customer-facing business name).
- `PAYPAL_INVOICER_NAME=GizOps` (or the legal/business invoicer name).
- `NEXT_PUBLIC_APP_URL=https://your-production-gizops-domain.com`

## Webhook

In the REST app, add this webhook URL:

`https://your-production-gizops-domain.com/api/paypal/webhook`

Subscribe to:

- `PAYMENT.CAPTURE.COMPLETED`

Copy the webhook's ID after saving it. The webhook ID is different from the REST app client ID.

## Branded PayPal email domain

In the PayPal Business account, enable the custom/branded sending-domain feature if it is available for the account. PayPal will provide DNS records. Add exactly those records at the DNS provider for the GizOps or Zig's Kitchen domain, wait for verification, and select the verified sender in PayPal.

The domain setup controls how PayPal-generated invoice emails appear. It does not replace the API credentials or webhook above.

## Database and deployment

1. Run `supabase/paypal_migration.sql` in the Supabase SQL editor.
2. Add the PayPal variables to Vercel Project Settings -> Environment Variables.
3. Redeploy GizOps.
4. Create a sandbox deposit and complete it with a PayPal sandbox buyer.
5. Confirm the related booking, meal-prep client, or POS order is marked paid.
6. Send a sandbox invoice and confirm the customer email/link is generated.
7. Create a live REST app and live webhook, replace the sandbox values, set `PAYPAL_ENVIRONMENT=live`, and redeploy.
