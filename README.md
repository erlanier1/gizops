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
- `CONTACT_FROM_EMAIL` - verified sender address for contact lead notifications.

Stripe payments also require:

- `STRIPE_PUBLISHABLE_KEY` - publishable Stripe key for reference in deployment settings.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - browser-safe publishable key when client-side Stripe.js is needed.
- `STRIPE_SECRET_KEY` - server-only Stripe secret key used by Checkout, Payment Links, and Invoicing.
- `STRIPE_WEBHOOK_SECRET` - server-only webhook signing secret for `/api/stripe/webhook`.
- `NEXT_PUBLIC_APP_URL` - the app URL used in Stripe success and cancel redirects.

For Vercel, set those values in Project Settings -> Environment Variables. For local testing, set them in `.env.local` and restart the server.

### First Company Setup

Run these Supabase SQL files in this order:

1. `supabase/business_profiles.sql`
2. `supabase/contact_leads.sql`
3. `supabase/seed_zigs_kitchen.sql`

`seed_zigs_kitchen.sql` creates Zig's Kitchen as the first company with all app modules enabled. After your auth user exists, update the final commented SQL statement with your Supabase auth user id to attach your login to Zig's Kitchen while keeping super admin access.

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

### Stripe Payment Flows

- Deposit collection uses Stripe Checkout through `/api/create-checkout-session`.
- Reminder emails can request a one-time deposit URL from `/api/payments/deposit-link` and include the returned `url`.
- Corporate/daycare invoices can be created through `/api/payments/invoice`, which sends a Stripe invoice supporting ACH (`us_bank_account`) and card.
- Stripe webhook events at `/api/stripe/webhook` mark linked bookings as `deposit_paid` and `confirmed` when metadata includes `bookingId`.

## Sections

- **Dashboard** — overview of bookings, permits, and documents
- **Permits** — track permit status and expiry alerts
- **Bookings** — manage food truck and catering events
- **Documents** — store and review operational files

## User Manual

See `docs/USER_MANUAL.md` for the operating guide covering login, company onboarding, modules, payments, contacts, reports, production setup, and current limitations.
