# GizOps
**Operations built for food truck operators**

Internal operations platform for Zig's Kitchen — managing permits, bookings, and documents for the food truck and catering business.

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Supabase (database, auth, file storage)
- Resend (email alerts)
- shadcn/ui

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.local.example` and fill in your Supabase and Resend credentials.

Website contact intake and email notifications use:

- `RESEND_API_KEY` - Resend API key for outbound email notifications.
- `CONTACT_FROM_EMAIL` - verified sender address for contact lead notifications and fallback app emails.
- `INVITE_FROM_EMAIL` - optional verified sender address for GizOps user invitations.

PayPal payments require a PayPal REST app:

- `PAYPAL_CLIENT_ID` - server-side REST app client ID.
- `PAYPAL_CLIENT_SECRET` - server-only REST app secret.
- `PAYPAL_WEBHOOK_ID` - ID of the webhook registered for `/api/paypal/webhook`.
- `PAYPAL_ENVIRONMENT` - `sandbox` while testing, then `live` for production.
- `PAYPAL_BRAND_NAME` - customer-facing checkout brand name.
- `PAYPAL_INVOICER_NAME` - sender name used on PayPal invoices.
- `NEXT_PUBLIC_APP_URL` - deployed GizOps URL used for PayPal return and cancel redirects.

Never commit the real secret values. Put them in `.env.local` for local work and in Vercel Project Settings for deployment.

For Vercel, set those values in Project Settings -> Environment Variables. For local testing, set them in `.env.local` and restart the server.

### First Company Setup

Run these Supabase SQL files in this order:

1. `supabase/business_profiles.sql`
2. `supabase/contact_leads.sql`
3. `supabase/purchase_receipts.sql`
4. `supabase/seed_zigs_kitchen.sql`

`seed_zigs_kitchen.sql` creates Zig's Kitchen as the first company with all app modules enabled. After your auth user exists, update the final commented SQL statement with your Supabase auth user id to attach your login to Zig's Kitchen while keeping super admin access.

`purchase_receipts.sql` creates the private receipt storage bucket, company-scoped receipt records, review statuses, and row-level security policies.

### Website Contact Intake

Company websites can send contact forms into GizOps with the company slug:

```js
await fetch('https://your-gizops-domain.com/api/contact-leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountSlug: 'zigs-kitchen',
    contactName: 'Jane Customer',
    email: 'jane@example.com',
    phone: '555-555-0199',
    companyName: 'Jane Events',
    serviceInterest: 'Catering',
    message: 'I need catering for 75 people next month.',
    consentToContact: true
  })
});
```

The lead is saved to `contact_leads`. If `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, and the business profile contact email are configured, GizOps also sends a notification email.

### PayPal Payment Flows

- Deposit collection creates a PayPal order through `/api/create-checkout-session`.
- Reminder emails can request a one-time deposit URL from `/api/payments/deposit-link` and include the returned `url`.
- Corporate/daycare invoices can be created and emailed through PayPal Invoicing at `/api/payments/invoice`.
- PayPal returns approved orders through `/api/paypal/capture`; the server captures payment before marking it paid.
- Create a PayPal webhook pointing to `/api/paypal/webhook` and subscribe to `PAYMENT.CAPTURE.COMPLETED`.
- Run `supabase/paypal_migration.sql` in Supabase before enabling live payments.

See `docs/PAYPAL_SETUP.md` for the complete sandbox-to-live checklist.

## Sections

- **Dashboard** — overview of bookings, permits, and documents
- **Permits** — track permit status and expiry alerts
- **Bookings** — manage food truck and catering events
- **Receipts** — store purchase receipts, review expenses, and track spending
- **Documents** — store and review operational files

## User Manual

See `docs/USER_MANUAL.md` for the operating guide covering login, company onboarding, modules, payments, contacts, reports, production setup, and current limitations.
