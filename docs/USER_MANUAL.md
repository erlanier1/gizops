# GizOps User Manual

Last updated: May 25, 2026

## Purpose

GizOps is an operations platform for service businesses. The current version supports food service first, with company customization for beauty and general service businesses.

The app is built around companies. Each company has its own profile, enabled modules, custom labels, contacts/leads, billing links, and operational data. ACIRE super admins can manage companies and open a company workspace to review that company's setup and activity.

## User Roles

### ACIRE Owner / Super Admin

The ACIRE owner can:

- Create and manage companies.
- Enable or disable modules for each company.
- Set industry type and custom wording.
- Add billing and payment processor links.
- Open a company workspace from the Companies page.
- View company-aware areas such as contacts and reports.
- Invite company owners.

### Company Owner

Company owners can:

- Manage their company's settings.
- Invite and manage team users.
- Access owner-level modules assigned to their company.
- Review reports, payments, contacts, bookings, inventory, documents, and other enabled modules.

### Manager

Managers can:

- Create and update operational records.
- View payments where allowed.
- Work with bookings, contacts, meal prep clients, inventory, and reports if modules are enabled.

### Staff

Staff users have limited operational access. They can use assigned workflows such as POS or event views without full administrative controls.

## Login And Sign Out

Use the app login page to sign in with a Supabase-authenticated user account.

If the app opens automatically on Vercel, that means the browser still has an active session cookie. This is normal. To fully clear it:

1. Click **Sign Out** in the sidebar.
2. The app redirects through `/auth/signout`.
3. The login page should show a signed-out confirmation.

If an old session is still stuck, open:

```text
https://your-vercel-domain/auth/signout
```

Then sign in again with the correct account.

## Company Setup

Go to **Companies** from the sidebar as the ACIRE owner.

Use **New Company** to create a company record.

Required fields:

- Company name
- Platform slug
- Industry

Recommended fields:

- Owner contact name
- Owner contact email
- Business phone
- Tagline
- Enabled modules

The platform slug is used by website intake forms and future company-specific links. Example:

```text
zigs-kitchen
```

## Company Industry

Each company has one industry:

- `food_service`
- `beauty`
- `general_service`

The industry controls default wording in the app.

Examples:

- Food service can use **Bookings**, **Proposals**, **POS**, and **Inventory**.
- Beauty can use **Appointments**, **Service Quotes**, **Checkout**, and **Products & Supplies**.
- General service can use **Appointments**, **Quotes**, **Payments**, and **Contacts**.

## Custom Labels

On each company card, use **Company Customization** to override wording.

Blank label fields use the industry default. Filled label fields override the default.

Common examples:

- Rename **Bookings** to **Appointments**.
- Rename **Proposals** to **Quotes**.
- Rename **Inventory** to **Products & Supplies**.
- Rename **POS** to **Checkout**.
- Rename **Contacts** to **Clients & Leads**.

Click **Save Customization** after making changes.

## Enabled Modules

Modules control what a company can access.

Current modules:

- Meal Prep
- Bookings
- Compliance
- Proposals
- POS
- Inventory
- Contacts
- Documents
- Reports

On the Companies page, use the module buttons on each company card to enable or disable access.

If a module is disabled, company users should not see that module in the sidebar.

## Opening A Company Workspace

As the ACIRE owner:

1. Go to **Companies**.
2. Find the company.
3. Click **Open Workspace**.

This sets the selected company workspace for the admin session. The sidebar will also show a **Company Workspace** dropdown so you can switch between companies.

The selected company controls:

- Sidebar module labels.
- Enabled module visibility.
- Business profile branding.
- Contacts/leads view.
- Report export filtering.

## Billing And Payment Links

Billing information is stored in the company profile. It is not hard-coded into the app.

Supported billing fields:

- Billing provider
- Billing status
- Plan name
- Stripe payment or subscription link
- Stripe customer ID
- Stripe subscription ID
- Square location ID
- PayPal merchant ID

Recommended current setup:

- Use Stripe for platform subscriptions and deposits.
- Store the Stripe payment link on the company record.
- Use Square or PayPal fields only when those processors are needed later.

Payment note for customers:

The app should communicate that card information is not stored in GizOps. Payments are handled by the payment processor, and GizOps stores contact and operational information only.

## Contacts And Leads

The **Contacts** module stores website leads and client contact inquiries.

Companies can collect contact information from their website by posting to:

```text
/api/contact-leads
```

Website forms should include:

- Company slug
- Contact name
- Email
- Phone
- Company name, if applicable
- Service interest
- Message
- Consent to contact

Example payload:

```json
{
  "accountSlug": "zigs-kitchen",
  "contactName": "Jane Customer",
  "email": "jane@example.com",
  "phone": "555-555-0199",
  "companyName": "Jane Events",
  "serviceInterest": "Catering",
  "message": "I need catering for 75 people next month.",
  "consentToContact": true
}
```

The Contacts page lets users review leads and update follow-up status.

## Dashboard

The Dashboard gives a high-level operations view.

It shows:

- Bookings
- Active permits
- Documents
- Confirmed value
- Upcoming bookings
- Permit status

For ACIRE admins, the dashboard identifies the selected company workspace.

## Meal Prep

The Meal Prep module includes:

- Schedule
- Clients
- Payments

Client records can include:

- Client name
- Email
- Phone
- Plan
- Child name for daycare meal prep
- Start date
- Delivery address
- Delivery window
- Meals per week
- Dietary notes
- Allergies
- Deposit amount
- Payment status
- Stripe payment link

Use this for individual, family, corporate, and daycare meal prep customers.

## Bookings

The Bookings module tracks events and service appointments.

Food service examples:

- Catering events
- Food truck bookings
- Private events

Beauty or general service examples:

- Appointments
- Consultations
- Service visits

Bookings are used by reports and payment/deposit workflows.

## Proposals

The Proposals module stores contract proposal drafts for catering or service events.

Use it to track:

- Proposal number
- Client details
- Event details
- Menu or service summary
- Terms
- Total amount
- Deposit amount
- Due date
- Status
- Internal notes

Proposal statuses:

- Draft
- Sent
- Accepted
- Declined
- Expired

## POS

The POS module is intended for taking orders, especially for food truck operations.

The long-term workflow is:

1. Take the order in POS.
2. Send the customer to Stripe Checkout or another payment processor.
3. Record the order in GizOps.
4. Deduct supplies from inventory.
5. Include sales/order data in reports.

Current Stripe payment processing depends on production environment variables.

## Inventory

The Inventory module tracks supplies and products.

Inventory records can include:

- Item name
- Category
- Unit
- Quantity on hand
- Par level
- Reorder quantity
- Vendor
- Storage location
- Expiration date
- Cost per unit
- SKU
- Notes

Food service examples:

- Proteins
- Dry goods
- Packaging
- Beverages

Beauty examples:

- Retail products
- Treatment supplies
- Tools and consumables

## Compliance

The Compliance module was previously called Permits.

Use it for:

- Permits
- Licenses
- Inspections
- Insurance
- Certifications
- Renewal tracking

This module helps monitor expiration dates and compliance risk.

## Documents

The Documents module stores operational files.

Examples:

- Permits
- Insurance files
- Contracts
- Menus
- SOPs
- Client files
- Vendor documents

Documents are included in standard reports.

## Reports

The Reports module exports standard reports in:

- Word
- Excel
- PDF

Current report types:

- Operations Overview
- Booking Pipeline
- Revenue Summary
- Permit Compliance
- Document Inventory

For ACIRE admins, reports use the selected company workspace when an account is selected.

## Team Management

Use **Team** to manage users.

Recommended access model:

- ACIRE owner remains the only platform-wide super admin.
- Each company has at least one owner.
- Owners manage their own company users.
- Managers handle daily operations.
- Staff receive limited access.

When onboarding a new company, invite the owner from the company card.

## Production Readiness Checklist

Before moving a company to production:

- Company record is created.
- Industry is selected.
- Modules are enabled correctly.
- Custom labels are reviewed.
- Owner contact is saved.
- Owner invite is sent.
- Billing provider and payment links are saved.
- Stripe environment variables are configured in Vercel.
- Supabase SQL files have been run.
- Contact form integration has been tested.
- Reports export successfully.
- Sign out works from Vercel.

## Supabase SQL Setup Order

Run these files in Supabase when preparing the database:

```text
supabase/business_profiles.sql
supabase/contact_leads.sql
supabase/tenant_data_scope.sql
supabase/seed_zigs_kitchen.sql
```

Use `seed_zigs_kitchen.sql` only when creating or refreshing the Zig's Kitchen starter company.

## Vercel Environment Variables

Production needs these values in Vercel Project Settings:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
CONTACT_FROM_EMAIL
```

Restart or redeploy after changing environment variables.

## Known Current Limitations

Some older operational tables were created before the multi-company model. The `tenant_data_scope.sql` file adds company ownership columns to those tables.

The next build phase should make every create/edit workflow save the selected company `account_id` automatically. That will complete company-level data separation for all new records.

Recommended next technical work:

- Wire bookings, permits, documents, inventory, proposals, POS, and meal prep creates to the selected company.
- Update table policies to enforce company-specific access everywhere.
- Add report filters for dates and status.
- Add a built-in Help/User Guide page inside the app.
- Add company website contact form templates.
