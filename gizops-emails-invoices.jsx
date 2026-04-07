import { useState } from "react";

const C = {
  fire: "#E8521A", coal: "#1A1008", smoke: "#2D2416", ash: "#4A3D2E",
  cream: "#F5EDD9", gold: "#D4A84B", muted: "#8A7560",
  green: "#4A9E6B", blue: "#4A7FE8", teal: "#2AA8A0", red: "#E84040"
};

const tabs = ["Build Prompts", "Email Previews", "Invoice Preview"];

const prompts = [
  {
    step: "E1",
    label: "Booking Confirmation Email",
    timing: "45 min",
    color: C.teal,
    description: "Triggers automatically when a booking moves to 'confirmed' status. Sends to the client AND notifies George.",
    prompt: `Add booking confirmation emails to GizOps using Resend.

FILE: app/api/send-booking-confirmation/route.ts

1. API ROUTE: POST /api/send-booking-confirmation
   Accepts: { bookingId }
   - Fetches full booking record from Supabase
   - Sends confirmation email to client's email address
   - Sends notification email to ALERT_EMAIL (George)
   - Returns { success: true, messageId }

2. CLIENT CONFIRMATION EMAIL:
Subject: "You're confirmed! Zig's Kitchen & Catering 🔥"

HTML Email Design:
- Header: fire orange background (#E8521A), white text
  "Zig's Kitchen & Catering" — large, bold
  "Your booking is confirmed!" — subtitle
- Body (cream background #F5EDD9):
  "Hi [client_name],"
  "We're excited to cater your event! Here are your booking details:"

  BOOKING DETAILS BOX (dark background):
  - Event Type: [event_type]
  - Date: [event_date formatted as "Saturday, April 5, 2026"]
  - Time: [event_time]
  - Location: [event_location]
  - Guest Count: [guest_count] guests
  - Package: [package_description]

  PAYMENT SUMMARY BOX:
  - Total Quote: $[quote_amount]
  - Deposit Due: $[deposit_amount] (required to hold your date)
  - Balance Due: $[quote_amount - deposit_amount] (due 7 days before event)

  PAYMENT METHODS SECTION:
  "To secure your booking, please submit your deposit via:"
  - Zelle: [GEORGE_ZELLE from env or placeholder]
  - Venmo: [GEORGE_VENMO from env or placeholder]
  - CashApp: [GEORGE_CASHAPP from env or placeholder]
  - Check payable to: Zig's Kitchen & Catering

  FOOTER:
  "Questions? Reply to this email or call/text [GEORGE_PHONE]"
  "We look forward to serving you!"
  — The Zig's Kitchen Team

3. GEORGE NOTIFICATION EMAIL:
Subject: "🔥 New Confirmed Booking — [client_name] on [event_date]"
Simple text email:
- Client name, email, phone
- Event date, type, guest count
- Quote amount, deposit amount
- Link to booking in GizOps: [APP_URL]/bookings/[id]

4. TRIGGER: In the bookings status update function,
   when status changes TO 'confirmed':
   - Call this API route automatically
   - Show toast: "Confirmation email sent to [client email]"
   - Log in booking notes: "Confirmation sent [timestamp]"

5. MANUAL RESEND BUTTON:
   In the booking detail panel, add:
   "Resend Confirmation" button (shows only for confirmed bookings)

Add these env vars to .env.local and .env.example:
GEORGE_PHONE=
GEORGE_ZELLE=
GEORGE_VENMO=
GEORGE_CASHAPP=`,
    note: "After building: fill in GEORGE_PHONE, GEORGE_ZELLE, GEORGE_VENMO in .env.local with George's real payment handles. Test by creating a booking and moving it to confirmed."
  },
  {
    step: "E2",
    label: "Invoice Generator",
    timing: "1.5 hours",
    color: C.gold,
    description: "Generates a professional PDF invoice for any confirmed booking. Auto-numbered, downloadable, and sendable by email.",
    prompt: `Add invoice generation to GizOps bookings.

FILES:
- app/api/generate-invoice/route.ts
- components/bookings/InvoicePreview.tsx
- lib/invoice-number.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. INVOICE NUMBERING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In lib/invoice-number.ts:
- Generate sequential invoice numbers: GIZ-2026-001, GIZ-2026-002, etc.
- Store the last invoice number in a simple Supabase table: app_settings
  CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY,
    value text
  );
  INSERT INTO app_settings VALUES ('last_invoice_number', '0')
  ON CONFLICT DO NOTHING;
- Function: getNextInvoiceNumber() → increments and returns next number
- Save the invoice_number back to the bookings table
  (add column: invoice_number text, invoice_generated_at timestamptz)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. INVOICE CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generate a clean, professional invoice HTML that can be printed to PDF.

Invoice layout:
HEADER ROW:
  Left: "Zig's Kitchen & Catering" (large, fire orange)
        Address, phone, email (from env vars or placeholder)
  Right: "INVOICE"
         Invoice #: GIZ-2026-001
         Date: [today's date]
         Due Date: [event_date minus 7 days]

BILL TO BOX:
  Client name
  Client email
  Client phone

EVENT DETAILS:
  Event Date: [formatted]
  Event Time: [time]
  Location: [address]
  Event Type: [type]
  Guest Count: [number]

LINE ITEMS TABLE:
  Description                    | Qty | Unit Price | Total
  ———————————————————————————————————————————————————
  [package_description]          |  1  | $[amount]  | $[amount]
  ———————————————————————————————————————————————————
                          Subtotal:              $[quote_amount]
                          Deposit Paid:         -$[deposit_amount] (if paid)
                          BALANCE DUE:           $[balance]

PAYMENT INSTRUCTIONS BOX (highlighted):
  "Payment Due: [due date]"
  Accepted methods:
  • Zelle: [GEORGE_ZELLE]
  • Venmo: [GEORGE_VENMO]
  • CashApp: [GEORGE_CASHAPP]
  • Check payable to: Zig's Kitchen & Catering

TERMS (small text):
  "50% deposit required to confirm booking. 
   Balance due 7 days prior to event date.
   Cancellations within 14 days of event forfeit deposit.
   Thank you for choosing Zig's Kitchen & Catering!"

FOOTER: "Questions? [GEORGE_PHONE] | [GEORGE_EMAIL]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PDF GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use window.print() with a print stylesheet for simplicity:
- Add @media print CSS to hide nav, buttons, everything except invoice
- "Download Invoice" button triggers window.print()
- Browser's "Save as PDF" produces the invoice file

OR install @react-pdf/renderer for true PDF generation:
npm install @react-pdf/renderer
- Create a PDF component matching the layout above
- API route generates PDF buffer and returns it
- Client downloads as GIZ-2026-001-[ClientName].pdf

Use @react-pdf/renderer (better for email attachment).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. UI CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In the booking detail panel, add (for confirmed bookings only):
- "Generate Invoice" button → creates invoice, saves number to booking
- "Download Invoice" button (shows after generated) → downloads PDF
- "Send Invoice" button → see Step E3
- Invoice number display: "Invoice #GIZ-2026-001 generated Mar 20, 2026"

In the bookings list/pipeline:
- Show invoice badge on booking cards that have been invoiced
- Badge: "Invoiced" in gold color`,
    note: "After building: generate a test invoice for a fake booking. Verify the invoice number increments correctly (GIZ-2026-001, then GIZ-2026-002). Check that the PDF looks clean before testing with George's real bookings."
  },
  {
    step: "E3",
    label: "Send Invoice by Email",
    timing: "45 min",
    color: C.fire,
    description: "Emails the generated invoice PDF as an attachment directly to the client from inside GizOps.",
    prompt: `Add "Send Invoice" email functionality to GizOps.

FILE: app/api/send-invoice/route.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. API ROUTE: POST /api/send-invoice
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Accepts: { bookingId }
- Fetches booking + client details from Supabase
- Generates the invoice PDF (calls invoice generation logic)
- Sends email via Resend with PDF attached
- Updates booking: invoice_sent_at = now()
- Returns { success: true }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. INVOICE EMAIL TO CLIENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subject: "Invoice #[number] — Zig's Kitchen & Catering"

HTML Email:
Header: fire orange, "Zig's Kitchen & Catering"
Body:
  "Hi [client_name],"
  
  "Please find your invoice attached for your upcoming event."
  
  SUMMARY BOX:
  Invoice #: GIZ-2026-001
  Event Date: [date]
  Amount Due: $[balance_due]
  Payment Due: [due date]
  
  "To pay your balance:"
  [same payment methods as confirmation email]
  
  "Once payment is received, we'll send you a receipt.
   Looking forward to your event!"
  
  — The Zig's Kitchen Team
  [phone] | [email]

Attachment: invoice PDF named "GIZ-2026-001-[ClientName].pdf"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. GEORGE NOTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Also send to ALERT_EMAIL:
Subject: "📄 Invoice sent to [client_name]"
- Invoice number, amount, client email
- Link to booking in GizOps

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. UI UPDATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In the booking detail panel:
- "Send Invoice" button → triggers this API
- After sending: button changes to "Resend Invoice"
- Show: "Invoice sent [date] to [client email]"
- If invoice not yet generated: disable button, 
  show "Generate invoice first"

In the bookings pipeline card:
- Add small "📄 Sent" indicator when invoice_sent_at is set

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. PAYMENT RECEIVED FLOW (bonus)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add "Mark Deposit Paid" button in booking detail:
- Sets deposit_paid = true, records payment date
- Sends receipt email to client:
  Subject: "Deposit received — You're all set! 🔥"
  "Hi [name], we received your deposit of $[amount].
   Your event on [date] is confirmed and locked in.
   Remaining balance of $[balance] is due [due date]."

Add "Mark Balance Paid" button:
- Sets balance_paid = true
- Sends final receipt:
  "Payment received in full. See you on [date]! 🔥"`,
    note: "Test the full flow end to end: Create booking → Confirm → Generate Invoice → Send Invoice → check that the email arrives with the PDF attached. This is the complete client communication workflow."
  },
  {
    step: "E4",
    label: "Deploy to Vercel + Connect gizops.com",
    timing: "30 min",
    color: C.green,
    description: "Get GizOps live on gizops.com so George can use it from any device.",
    prompt: `Deploy GizOps to Vercel and connect the gizops.com domain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: PUSH TO GITHUB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run these commands in the terminal:

git init
git add .
git commit -m "GizOps v1.0 — initial launch"
git branch -M main

Then create a new repo at github.com named "gizops" and run:
git remote add origin https://github.com/YOUR_USERNAME/gizops.git
git push -u origin main

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: DEPLOY ON VERCEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to vercel.com → Sign up / Log in with GitHub
2. Click "Add New Project"
3. Import the "gizops" repository
4. Framework preset: Next.js (auto-detected)
5. Add ALL environment variables from .env.local:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - RESEND_API_KEY
   - ALERT_EMAIL
   - ALERT_FROM_EMAIL
   - NEXT_PUBLIC_BUSINESS_NAME
   - NEXT_PUBLIC_APP_URL (set to https://gizops.com)
   - GEORGE_PHONE
   - GEORGE_ZELLE
   - GEORGE_VENMO
   - GEORGE_CASHAPP
6. Click Deploy — takes about 2 minutes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: CONNECT GIZOPS.COM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In Vercel:
- Project → Settings → Domains
- Click "Add Domain"
- Type: gizops.com → Add
- Vercel will show you DNS records to add

In Namecheap (where you bought the domain):
- Go to Domain List → gizops.com → Manage
- Click "Advanced DNS"
- Delete any existing A records or CNAME for @
- Add these records:

  Type: A Record
  Host: @
  Value: 76.76.21.21
  TTL: Automatic

  Type: CNAME
  Host: www
  Value: cname.vercel-dns.com
  TTL: Automatic

- Save all changes
- Wait 5–15 minutes for DNS to propagate
- Visit gizops.com — GizOps should be live!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: ADD CRON JOB FOR DAILY ALERTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create vercel.json in the project root:
{
  "crons": [
    {
      "path": "/api/check-permits",
      "schedule": "0 9 * * *"
    }
  ]
}

This runs permit expiration checks every day at 9am UTC.
Commit and push — Vercel auto-deploys.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: TEST EVERYTHING LIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After deployment verify:
- gizops.com loads the dashboard
- Login works
- Can add a permit and it saves to Supabase
- Can create a booking and confirm it
- Confirmation email arrives in inbox
- Invoice generates with correct number
- Invoice email arrives with PDF attached
- gizops.com shows as secure (https padlock)`,
    note: "Every time you push to GitHub after this, Vercel auto-deploys within 60 seconds. No manual deployment steps ever again."
  }
];

// ─── EMAIL PREVIEWS ───────────────────────────────────────────────────────────

function ConfirmationEmailPreview() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", fontFamily: "Georgia, serif" }}>
      <div style={{ background: C.fire, padding: "24px 28px", borderRadius: "8px 8px 0 0" }}>
        <div style={{ color: C.cream, fontSize: 22, fontWeight: 800 }}>Zig's Kitchen & Catering</div>
        <div style={{ color: "#F5EDD9CC", fontSize: 14, marginTop: 4 }}>Your booking is confirmed! 🔥</div>
      </div>
      <div style={{ background: C.cream, padding: "24px 28px" }}>
        <div style={{ fontSize: 14, color: "#3A2E1E", lineHeight: 1.8, marginBottom: 16 }}>
          Hi <strong>Marcus Johnson</strong>,<br />
          We're excited to cater your event! Here are your confirmed booking details:
        </div>
        <div style={{ background: C.smoke, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Booking Details</div>
          {[
            ["Event Type", "Wedding Reception"],
            ["Date", "Saturday, April 5, 2026"],
            ["Time", "5:00 PM"],
            ["Location", "5400 Auth Rd, Suitland, MD"],
            ["Guests", "120 guests"],
            ["Package", "Full catering service, buffet style"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.ash}33`, fontSize: 13 }}>
              <span style={{ color: C.muted }}>{k}</span>
              <span style={{ color: C.cream, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#FFF8E8", border: `1px solid ${C.gold}55`, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Payment Summary</div>
          {[
            ["Total Quote", "$3,200.00"],
            ["Deposit Due Now", "$1,600.00"],
            ["Balance Due (Mar 29)", "$1,600.00"],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, fontWeight: i === 2 ? 800 : 400 }}>
              <span style={{ color: "#5A4A1E" }}>{k}</span>
              <span style={{ color: i === 2 ? C.fire : "#3A2E1E" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#F0F7F0", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "14px 16px", marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#2A6A3A", marginBottom: 8 }}>Pay Your Deposit</div>
          <div style={{ color: "#3A5A3E", lineHeight: 1.8 }}>
            • <strong>Zelle:</strong> george@zigskitchen.com<br />
            • <strong>Venmo:</strong> @ziggs-kitchen<br />
            • <strong>CashApp:</strong> $ZigsKitchen<br />
            • <strong>Check</strong> payable to: Zig's Kitchen & Catering
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#5A4A3E", lineHeight: 1.7 }}>
          Questions? Reply to this email or call/text <strong>(301) 555-0123</strong><br />
          We look forward to serving you!
        </div>
      </div>
      <div style={{ background: C.smoke, padding: "12px 28px", borderRadius: "0 0 8px 8px", textAlign: "center" }}>
        <div style={{ color: C.muted, fontSize: 11 }}>Zig's Kitchen & Catering · Prince George's County, MD</div>
      </div>
    </div>
  );
}

function InvoiceEmailPreview() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", fontFamily: "Georgia, serif" }}>
      <div style={{ background: C.coal, padding: "24px 28px", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ background: C.fire, borderRadius: 8, padding: "8px 12px", fontSize: 20 }}>📄</div>
        <div>
          <div style={{ color: C.cream, fontSize: 18, fontWeight: 800 }}>Zig's Kitchen & Catering</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>Invoice #GIZ-2026-004 attached</div>
        </div>
      </div>
      <div style={{ background: C.cream, padding: "24px 28px" }}>
        <div style={{ fontSize: 14, color: "#3A2E1E", lineHeight: 1.8, marginBottom: 16 }}>
          Hi <strong>Marcus Johnson</strong>,<br />
          Please find your invoice attached for your upcoming event. Here's a quick summary:
        </div>
        <div style={{ background: C.smoke, borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
          {[
            ["Invoice #", "GIZ-2026-004"],
            ["Event Date", "Saturday, April 5, 2026"],
            ["Amount Due", "$1,600.00"],
            ["Payment Due By", "Saturday, March 29, 2026"],
          ].map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.ash}33`, fontSize: 13 }}>
              <span style={{ color: C.muted }}>{k}</span>
              <span style={{ color: i === 2 ? C.fire : C.cream, fontWeight: i === 2 ? 800 : 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#FFF8E8", border: `1px solid ${C.gold}55`, borderRadius: 8, padding: "14px 16px", marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#5A4A1E", marginBottom: 8 }}>Pay Your Balance</div>
          <div style={{ color: "#3A2E1E", lineHeight: 1.8 }}>
            • <strong>Zelle:</strong> george@zigskitchen.com<br />
            • <strong>Venmo:</strong> @ziggs-kitchen<br />
            • <strong>CashApp:</strong> $ZigsKitchen
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#8A7560", fontStyle: "italic", lineHeight: 1.7 }}>
          Once payment is received, we'll send you a receipt confirmation. Looking forward to your event on April 5th!
        </div>
      </div>
      <div style={{ background: C.smoke, padding: "12px 28px", borderRadius: "0 0 8px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: C.muted, fontSize: 11 }}>Zig's Kitchen & Catering · (301) 555-0123</div>
        <div style={{ background: C.fire + "22", border: `1px solid ${C.fire}44`, color: C.fire, borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>📎 PDF Attached</div>
      </div>
    </div>
  );
}

// ─── INVOICE PREVIEW ──────────────────────────────────────────────────────────

function InvoicePreview() {
  return (
    <div style={{ maxWidth: 620, margin: "0 auto", background: C.cream, borderRadius: 8, padding: "32px 36px", fontFamily: "Georgia, serif", color: "#2A1E0E" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, paddingBottom: 20, borderBottom: `2px solid ${C.fire}` }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.fire }}>Zig's Kitchen & Catering</div>
          <div style={{ fontSize: 13, color: "#6A5A4A", marginTop: 6, lineHeight: 1.8 }}>
            Prince George's County, MD<br />
            (301) 555-0123<br />
            george@zigskitchen.com
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#3A2E1E", letterSpacing: "0.05em" }}>INVOICE</div>
          <div style={{ fontSize: 13, color: "#6A5A4A", marginTop: 6, lineHeight: 1.8 }}>
            <strong style={{ color: "#3A2E1E" }}>#GIZ-2026-004</strong><br />
            Date: March 20, 2026<br />
            Due: March 29, 2026
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Bill To</div>
        <div style={{ fontSize: 14, lineHeight: 1.8 }}>
          <strong>Marcus Johnson</strong><br />
          marcus.johnson@email.com<br />
          (301) 555-0456
        </div>
      </div>

      <div style={{ background: "#F0EAD8", borderRadius: 8, padding: "14px 16px", marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Event Details</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 13 }}>
          {[["Event Date","Saturday, April 5, 2026"],["Time","5:00 PM"],["Location","5400 Auth Rd, Suitland, MD"],["Guest Count","120 guests"],["Event Type","Wedding Reception"]].map(([k,v])=>(
            <div key={k}><span style={{ color: C.muted }}>{k}: </span><strong>{v}</strong></div>
          ))}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.coal }}>
            <th style={{ padding: "10px 14px", textAlign: "left", color: C.cream, fontWeight: 700 }}>Description</th>
            <th style={{ padding: "10px 14px", textAlign: "center", color: C.cream, fontWeight: 700, width: 50 }}>Qty</th>
            <th style={{ padding: "10px 14px", textAlign: "right", color: C.cream, fontWeight: 700, width: 90 }}>Price</th>
            <th style={{ padding: "10px 14px", textAlign: "right", color: C.cream, fontWeight: 700, width: 90 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: `1px solid #D4C4A8` }}>
            <td style={{ padding: "12px 14px" }}>Full catering service, buffet style<br /><span style={{ color: C.muted, fontSize: 11 }}>Wedding Reception — 120 guests</span></td>
            <td style={{ padding: "12px 14px", textAlign: "center" }}>1</td>
            <td style={{ padding: "12px 14px", textAlign: "right" }}>$3,200.00</td>
            <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>$3,200.00</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ padding: "8px 14px", textAlign: "right", color: C.muted, fontSize: 13 }}>Subtotal</td>
            <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700 }}>$3,200.00</td>
          </tr>
          <tr>
            <td colSpan={3} style={{ padding: "8px 14px", textAlign: "right", color: C.green, fontSize: 13 }}>Deposit Paid</td>
            <td style={{ padding: "8px 14px", textAlign: "right", color: C.green, fontWeight: 700 }}>-$1,600.00</td>
          </tr>
          <tr style={{ background: C.fire + "18", borderTop: `2px solid ${C.fire}` }}>
            <td colSpan={3} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, fontSize: 15 }}>BALANCE DUE</td>
            <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, fontSize: 15, color: C.fire }}>$1,600.00</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ background: "#FFF8E8", border: `1px solid ${C.gold}66`, borderRadius: 8, padding: "14px 16px", marginBottom: 20, fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: "#5A4A1E", marginBottom: 8 }}>Payment Instructions — Due March 29, 2026</div>
        <div style={{ color: "#3A2E1E", lineHeight: 1.9 }}>
          • <strong>Zelle:</strong> george@zigskitchen.com<br />
          • <strong>Venmo:</strong> @ziggs-kitchen<br />
          • <strong>CashApp:</strong> $ZigsKitchen<br />
          • <strong>Check</strong> payable to: Zig's Kitchen & Catering
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.8, borderTop: `1px solid #D4C4A8`, paddingTop: 14 }}>
        <em>50% deposit required to confirm booking. Balance due 7 days prior to event. Cancellations within 14 days of event forfeit deposit. Thank you for choosing Zig's Kitchen & Catering!</em>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function GizOpsEmailInvoiceGuide() {
  const [activeTab, setActiveTab] = useState(0);
  const [emailView, setEmailView] = useState("confirmation");
  const [copiedIdx, setCopiedIdx] = useState(null);

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: C.coal, color: C.cream, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: C.smoke, borderBottom: `1px solid ${C.ash}66`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.fire, fontFamily: "Georgia, serif" }}>GizOps — Emails & Invoices</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Steps E1–E4 · Confirmation emails · Invoice generator · Deploy to gizops.com</div>
        </div>
        <div style={{ display: "flex", gap: 4, background: C.coal, borderRadius: 8, padding: 4 }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, background: activeTab === i ? C.fire : "transparent", color: activeTab === i ? C.cream : C.muted, fontWeight: activeTab === i ? 700 : 400, transition: "all .15s" }}>{t}</button>
          ))}
        </div>
      </div>

      {activeTab === 0 && (
        <div style={{ padding: 20, overflowY: "auto", maxWidth: 840, margin: "0 auto", width: "100%" }}>
          <div style={{ padding: 12, background: `${C.gold}11`, border: `1px solid ${C.gold}33`, borderRadius: 8, marginBottom: 16, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
            Run these <strong style={{ color: C.cream }}>in order E1 → E2 → E3 → E4</strong>. E1–E3 build the email and invoice system. E4 deploys GizOps live to gizops.com.
          </div>
          {prompts.map((p, i) => (
            <div key={i} style={{ background: C.smoke, border: `1px solid ${C.ash}44`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${C.ash}33`, background: `${C.ash}22` }}>
                <span style={{ background: p.color, color: C.cream, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 800, fontFamily: "monospace" }}>STEP {p.step}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.cream }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.timing}</div>
                </div>
                <button onClick={() => copy(p.prompt, i)} style={{ background: copiedIdx === i ? C.green : C.coal, color: C.cream, border: `1px solid ${C.ash}`, borderRadius: 6, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600, transition: "background .2s" }}>
                  {copiedIdx === i ? "✓ Copied!" : "Copy Prompt"}
                </button>
              </div>
              <div style={{ padding: "12px 16px" }}>
                <p style={{ fontSize: 13, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>{p.description}</p>
                <pre style={{ background: C.coal, borderRadius: 8, padding: 12, fontSize: 11, color: "#A8D8A0", lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", border: `1px solid ${C.ash}33`, maxHeight: 240, overflowY: "auto" }}>{p.prompt}</pre>
                {p.note && <div style={{ marginTop: 8, padding: "8px 12px", background: `${p.color}11`, border: `1px solid ${p.color}33`, borderRadius: 6, fontSize: 12, color: p.color }}>💡 {p.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 1 && (
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, justifyContent: "center" }}>
            {[["confirmation", "✅ Booking Confirmation"], ["invoice", "📄 Invoice Email"]].map(([v, l]) => (
              <button key={v} onClick={() => setEmailView(v)} style={{ padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, background: emailView === v ? C.fire : C.ash + "66", color: emailView === v ? C.cream : C.muted, fontWeight: emailView === v ? 700 : 400 }}>{l}</button>
            ))}
          </div>
          <div style={{ background: "#E8E0D0", borderRadius: 12, padding: 20, maxWidth: 580, margin: "0 auto" }}>
            <div style={{ fontSize: 11, color: "#8A7560", marginBottom: 12, textAlign: "center" }}>Email preview — what the client receives</div>
            {emailView === "confirmation" ? <ConfirmationEmailPreview /> : <InvoiceEmailPreview />}
          </div>
        </div>
      )}

      {activeTab === 2 && (
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 16 }}>Invoice preview — PDF generated by GizOps and sent as email attachment</div>
          <div style={{ background: "#D4C8B0", borderRadius: 12, padding: 20, maxWidth: 660, margin: "0 auto" }}>
            <InvoicePreview />
          </div>
        </div>
      )}
    </div>
  );
}
