# GizOps User Manual

Last updated: June 23, 2026

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
- Return to the platform admin view from the Company Workspace dropdown.
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
- Receipts
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

To return to the platform-level admin view, open the **Company Workspace** dropdown and choose:

```text
Admin Portal — default view
```

This clears the selected company for the admin session and returns the sidebar and dashboard to the platform owner view. GizOps remembers this choice, so the ACIRE owner can keep the Admin Portal as the default view until a company workspace is selected again.

The selected company controls:

- Sidebar module labels.
- Enabled module visibility.
- Business profile branding.
- Contacts/leads view.
- Team invite target company.
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

### Form.io Lead Import

Form.io forms can post submissions directly to the same endpoint:

```text
/api/contact-leads?accountSlug=zigs-kitchen
```

Use a Form.io webhook or action that sends JSON. GizOps accepts standard Form.io submission payloads with fields inside `data`, including common keys such as:

- `contactName`, `name`, `fullName`, `firstName` and `lastName`
- `email`, `emailAddress`, or `contactEmail`
- `phone` or `phoneNumber`
- `companyName`, `company`, or `businessName`
- `serviceInterest`, `service`, `interest`, or `projectType`
- `message`, `comments`, `notes`, `details`, or `description`

Example Form.io-style payload:

```json
{
  "_id": "formio-submission-id",
  "data": {
    "contactName": "Jane Customer",
    "email": "jane@example.com",
    "phone": "555-555-0199",
    "serviceInterest": "Catering",
    "message": "I need catering for 75 people next month."
  }
}
```

Imported Form.io leads appear in the Contacts inbox with source `form_io`. Repeated submissions with the same Form.io submission ID are treated as duplicates.

### Formspree Lead Import

The current Zigs Kitchen Formspree endpoint is:

```text
https://formspree.io/f/mqedjyzr
```

That URL receives form submissions for Formspree. To send new leads into GizOps, either point the website form directly to GizOps or configure Formspree to forward submissions to:

```text
/api/contact-leads?accountSlug=zigs-kitchen
```

GizOps accepts Formspree-style URL-encoded form fields or JSON with common field names such as `name`, `email`, `phone`, `company`, `service`, and `message`. These leads appear in the Contacts inbox with source `formspree`.

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

## Receipts

The Receipts module stores purchase receipts and tracks expense review status.

Use it for:

- Food, ingredient, or inventory purchases.
- Packaging and supply receipts.
- Equipment, fuel, repair, marketing, office, or permit expenses.
- Receipts that should be easy to find later for review, bookkeeping, reimbursement, or reporting.

To add a receipt:

1. Open **Receipts** from the sidebar.
2. Click **Add Receipt** or **Upload First Receipt**.
3. Choose a JPG, PNG, WEBP, or PDF file.
4. Enter the vendor, purchase date, total, category, payment method, tax, and notes.
5. Click **Save Receipt**.

Receipts are stored by company workspace. For ACIRE admins, make sure the correct company is selected in the **Company Workspace** dropdown before uploading a receipt.

Receipt review statuses:

- **Needs review** means the receipt was uploaded and has not been reviewed yet.
- **Reviewed** means a manager or owner has checked it.
- **Flagged** means the receipt needs follow-up.

Managers and owners can upload receipts and update review status. Owners can delete receipt records and stored files.

The receipt file can be opened from the receipt detail window. PDFs open in a preview frame, and image files show directly in the app.

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

To invite a team member from inside GizOps:

1. Select the correct company in the **Company Workspace** dropdown.
2. Go to **Team**.
3. Click **Invite Team Member**.
4. Enter the person's full name and email address.
5. Choose their role.
6. Click **Send Invite**.

GizOps creates the user account and sends a secure password setup email. The new user follows the email link to set their password and log in.

For ACIRE super admins, a company workspace must be selected before inviting a company user. If **Admin Portal — default view** is selected, switch to the company first.

Invitation email setup requires Resend to be configured in production. At minimum, Vercel must include:

```text
RESEND_API_KEY
INVITE_FROM_EMAIL
NEXT_PUBLIC_APP_URL
```

The sender email must use a verified Resend domain. Current recommended sender:

```text
GizOps <invite@updates.gizops.com>
```

`CONTACT_FROM_EMAIL` can be used for contact alerts and as a fallback sender, but `INVITE_FROM_EMAIL` is preferred for user invitations.

## Production Readiness Checklist

Before moving a company to production:

- Company record is created.
- Industry is selected.
- Modules are enabled correctly.
- Custom labels are reviewed.
- Owner contact is saved.
- Owner invite is sent.
- Team invite email has been tested from inside GizOps.
- Billing provider and payment links are saved.
- Stripe environment variables are configured in Vercel.
- Resend domain and invite sender are verified.
- Supabase SQL files have been run.
- Receipts upload and preview have been tested if the Receipts module is enabled.
- Contact form integration has been tested.
- Reports export successfully.
- Sign out works from Vercel.

## Supabase SQL Setup Order

Run these files in Supabase when preparing the database:

```text
supabase/business_profiles.sql
supabase/contact_leads.sql
supabase/tenant_data_scope.sql
supabase/purchase_receipts.sql
supabase/seed_zigs_kitchen.sql
```

Use `seed_zigs_kitchen.sql` only when creating or refreshing the Zig's Kitchen starter company.

`purchase_receipts.sql` creates the receipts table, private receipt storage bucket, review statuses, indexes, and receipt access policies.

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
INVITE_FROM_EMAIL
```

Restart or redeploy after changing environment variables.

Recommended production email values:

```text
CONTACT_FROM_EMAIL=GizOps <invite@updates.gizops.com>
INVITE_FROM_EMAIL=GizOps <invite@updates.gizops.com>
NEXT_PUBLIC_APP_URL=https://www.gizops.com
```

Use only sender addresses from a verified Resend domain. If Resend DNS verification is still pending, invitations may fail even when the API key exists.

## Known Current Limitations

Some older operational tables were created before the multi-company model. The `tenant_data_scope.sql` file adds company ownership columns to those tables.

The next build phase should make every create/edit workflow save the selected company `account_id` automatically. That will complete company-level data separation for all new records.

Recommended next technical work:

- Wire bookings, permits, documents, inventory, proposals, POS, and meal prep creates to the selected company.
- Update table policies to enforce company-specific access everywhere.
- Add report filters for dates and status.
- Add a built-in Help/User Guide page inside the app.
- Add company website contact form templates.
