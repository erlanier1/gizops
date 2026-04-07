import { useState } from "react";

const COLORS = {
  fire: "#E8521A",
  ember: "#C93B0A",
  coal: "#1A1008",
  smoke: "#2D2416",
  ash: "#4A3D2E",
  cream: "#F5EDD9",
  gold: "#D4A84B",
  lightGold: "#F0D080",
  muted: "#8A7560",
};

const tabs = ["Claude Code Prompts", "Supabase Schema", "UI Mockup"];

const prompts = [
  {
    step: "01",
    phase: "Project Scaffold",
    timing: "Day 1 — ~20 min",
    title: "Initialize the Full Project",
    description: "Run this first. It creates the entire Next.js project structure, installs dependencies, and sets up Tailwind + Supabase client.",
    prompt: `Create a Next.js 14 app (app router) called "ZigsOps" — an operations tool for a food truck and catering business called Zig's Kitchen.

Tech stack:
- Next.js 14 with App Router
- Tailwind CSS
- Supabase (for database + auth + file storage)
- Resend (for email alerts)
- shadcn/ui components

Set up the following:
1. Install and configure Tailwind CSS
2. Install @supabase/supabase-js and @supabase/auth-helpers-nextjs
3. Create a /lib/supabase.ts client file with env variable placeholders
4. Create a basic layout with a sidebar nav linking to: Dashboard, Permits, Bookings, Documents
5. Use a dark color scheme with orange/amber accents (fire and ember theme — this is a catering business)
6. Add placeholder pages for each section

Color palette to use:
- Background: #1A1008 (coal dark)
- Sidebar: #2D2416 (smoke)
- Accent: #E8521A (fire orange)
- Gold: #D4A84B
- Text: #F5EDD9 (cream)`,
    note: "After running: open the folder in VS Code, create a .env.local file with your Supabase URL and anon key (from supabase.com → project settings → API)."
  },
  {
    step: "02",
    phase: "Database Setup",
    timing: "Day 1 — ~15 min",
    title: "Generate Supabase Schema SQL",
    description: "Paste this into Claude Code to get the SQL you'll run in Supabase's SQL editor to create all tables.",
    prompt: `Generate the complete SQL schema for a Supabase PostgreSQL database for ZigsOps — a food truck operations app. 

Create these tables:

1. permits
   - id (uuid, primary key)
   - name (text) — e.g. "PG County Health Permit"
   - issuing_agency (text)
   - permit_number (text)
   - issue_date (date)
   - expiration_date (date)
   - status (text) — values: 'active', 'expiring_soon', 'expired'
   - document_url (text) — link to uploaded file
   - notes (text)
   - reminder_sent (boolean, default false)
   - created_at (timestamptz, default now())

2. bookings
   - id (uuid, primary key)
   - client_name (text)
   - client_email (text)
   - client_phone (text)
   - event_date (date)
   - event_time (text)
   - event_location (text)
   - event_type (text) — values: 'catering', 'food_truck', 'pop_up'
   - guest_count (integer)
   - status (text) — values: 'inquiry', 'quoted', 'confirmed', 'completed', 'cancelled'
   - package_description (text)
   - quote_amount (decimal)
   - deposit_amount (decimal)
   - deposit_paid (boolean, default false)
   - notes (text)
   - created_at (timestamptz, default now())

3. documents
   - id (uuid, primary key)
   - name (text)
   - category (text) — values: 'insurance', 'permit', 'commissary', 'license', 'certification', 'contract', 'other'
   - file_url (text)
   - file_name (text)
   - expiration_date (date, nullable)
   - notes (text)
   - created_at (timestamptz, default now())

Also create Row Level Security policies that allow all operations for authenticated users.
Add indexes on expiration_date for permits and documents, and event_date for bookings.`,
    note: "Copy the SQL output → go to Supabase Dashboard → SQL Editor → New Query → paste and run."
  },
  {
    step: "03",
    phase: "Permit Tracker",
    timing: "Days 2–3 — ~3 hours",
    title: "Build the Permit Tracker Module",
    description: "This builds the full permits page: list view, add/edit form, expiration status badges, and the PG County pre-loaded checklist.",
    prompt: `Build the complete Permits module for ZigsOps. 

File: app/permits/page.tsx and supporting components in components/permits/

Features to build:

1. PERMITS LIST VIEW
   - Table/card list showing all permits
   - Each permit shows: name, agency, permit number, expiration date, status badge
   - Status badges: green "Active" (>60 days), yellow "Expiring Soon" (≤60 days), red "Expired"
   - Sort by expiration date (soonest first)
   - "Add Permit" button top right

2. ADD/EDIT PERMIT FORM (modal or slide-over panel)
   - All fields from the permits table
   - Date picker for issue/expiration dates
   - File upload for permit document (upload to Supabase Storage bucket called "permit-docs")
   - Save to Supabase

3. PG COUNTY QUICK-ADD CHECKLIST
   - A collapsible section or modal showing this pre-loaded list:
     * Mobile Food Service License (Prince George's County Health Dept) — annual
     * Commissary Agreement Letter — annual
     * Food Manager Certification (ServSafe) — every 5 years
     * Food Handler Cards (per employee) — every 3 years
     * MD State Sales Tax License (Comptroller of MD) — one-time
     * Business License (PG County) — annual
     * Vehicle Registration — annual
     * Commercial Auto Insurance Certificate — annual
     * General Liability Insurance Certificate ($1M min) — annual
   - User can click any item to pre-fill the add form with that permit's name and agency

4. DASHBOARD SUMMARY CARDS
   - "X permits active"
   - "X expiring within 60 days" (highlighted in amber)
   - "X expired" (highlighted in red)

Use the fire/ember color theme. Connect all reads/writes to Supabase.
Show loading states while data fetches. Handle empty state with a helpful message.`,
    note: "Test by adding Zig's Kitchen's real PG County health permit with the actual expiration date."
  },
  {
    step: "04",
    phase: "Email Alerts",
    timing: "Day 3 — ~1 hour",
    title: "Add Permit Expiration Email Alerts",
    description: "Builds the alert system so George gets emailed before permits expire.",
    prompt: `Add email alert functionality to ZigsOps using Resend.

1. Install resend package
2. Create /lib/resend.ts with Resend client using RESEND_API_KEY env variable
3. Create an API route at app/api/check-permits/route.ts that:
   - Queries Supabase for all permits where expiration_date is within 60 days AND reminder_sent = false
   - For each expiring permit, sends an email via Resend to a configured ALERT_EMAIL env variable
   - Email subject: "⚠️ Permit Expiring Soon: [permit name]"
   - Email body (HTML): Shows permit name, agency, expiration date, days remaining, and a note to renew
   - After sending, updates reminder_sent = true for that permit
   - Returns JSON summary of alerts sent

4. Add a "Send Test Alert" button on the permits page that calls this API route
5. Add a manual "Reset Reminder" button per permit (sets reminder_sent back to false) for re-testing

Style the email with Zig's Kitchen branding: fire orange header, cream background, clean layout.`,
    note: "Sign up at resend.com (free tier: 3,000 emails/month). Add your domain or use their sandbox for testing. Set ALERT_EMAIL to George's email."
  },
  {
    step: "05",
    phase: "Catering Bookings",
    timing: "Days 4–5 — ~4 hours",
    title: "Build the Catering Booking Pipeline",
    description: "The full bookings module with a Kanban-style pipeline view and proposal generator.",
    prompt: `Build the complete Bookings module for ZigsOps.

File: app/bookings/page.tsx and components/bookings/

Features:

1. PIPELINE VIEW (Kanban-style columns)
   - 5 columns: Inquiry | Quoted | Confirmed | Completed | Cancelled
   - Each booking shows as a card: client name, event date, event type, guest count, quote amount
   - Click a card to open the detail panel
   - "Move to next stage" button on each card
   - "New Inquiry" button top right

2. ADD/EDIT BOOKING FORM (modal)
   - All fields from the bookings table
   - Event type selector: Catering / Food Truck / Pop-Up
   - Guest count with +/- buttons
   - Quote amount with $ formatting
   - Deposit amount and "Mark deposit paid" toggle

3. BOOKING DETAIL PANEL (right slide-over)
   - Full booking details
   - Edit button
   - Status change dropdown
   - Notes section (editable)
   - "Generate Proposal" button (see #4)

4. PROPOSAL GENERATOR
   - Button generates a printable/downloadable proposal
   - Proposal includes:
     * Zig's Kitchen logo placeholder + contact info
     * Client name, event date, location, guest count
     * Package description
     * Quote amount + deposit amount + balance due
     * Standard catering terms (add placeholder text)
     * Signature line
   - Use @react-pdf/renderer or window.print() for PDF export

5. CALENDAR VIEW toggle (optional, do this last)
   - Simple monthly calendar showing confirmed bookings

Use Supabase for all data. Match the fire/ember theme.`,
    note: "Add Zig's Kitchen's next 2-3 real catering inquiries to test the pipeline flow."
  },
  {
    step: "06",
    phase: "Document Vault",
    timing: "Day 6 — ~2 hours",
    title: "Build the Document Vault",
    description: "Secure file storage for all business compliance documents.",
    prompt: `Build the Document Vault module for ZigsOps.

File: app/documents/page.tsx and components/documents/

Features:

1. DOCUMENT GRID
   - Card grid layout, each card shows: document name, category badge, upload date, expiration date (if set)
   - Category color badges: Insurance (blue), Permit (orange), Commissary (green), License (gold), Certification (purple), Contract (teal), Other (gray)
   - Click card to preview/download

2. UPLOAD FLOW
   - Drag-and-drop upload zone
   - OR click to browse files
   - After selecting file: form to enter name, category, optional expiration date, notes
   - Upload file to Supabase Storage bucket "business-docs"
   - Save metadata to documents table

3. FILTER & SEARCH
   - Filter by category (dropdown)
   - Search by document name
   - "Expiring Soon" filter toggle (shows docs expiring in 90 days)

4. PRE-LOADED CATEGORIES PROMPT
   - On first visit (no documents yet), show a helpful empty state with this checklist:
     * What to upload for Zig's Kitchen:
       - PG County Health Permit (PDF)
       - Commissary Kitchen Agreement
       - Business License
       - General Liability Insurance Cert
       - Commercial Auto Insurance Cert
       - ServSafe Manager Certification
       - Employee Food Handler Cards
       - Vehicle Registration
       - MD Sales Tax License

Create the Supabase Storage bucket "business-docs" with public read access.
Handle file size limits (max 10MB), show upload progress bar, handle errors gracefully.`,
    note: "Create the 'business-docs' bucket in Supabase Dashboard → Storage → New Bucket before testing."
  },
  {
    step: "07",
    phase: "Dashboard",
    timing: "Day 7 — ~2 hours",
    title: "Build the Main Dashboard",
    description: "The home screen that ties everything together with at-a-glance status.",
    prompt: `Build the main Dashboard page for ZigsOps at app/page.tsx (or app/dashboard/page.tsx).

This is the home screen George sees every time he opens the app.

Include these sections:

1. HEADER
   - "Good morning, Zig's Kitchen" with current date
   - Quick action buttons: "+ Add Permit", "+ New Booking", "+ Upload Doc"

2. ALERT BANNER (top, full width)
   - If any permits are expired or expiring within 30 days: show prominent red/amber banner
   - "🔥 Action Required: 2 permits expiring within 30 days" with link to permits page
   - Dismiss button (per session only)

3. STATS ROW (4 cards)
   - Active Permits (green)
   - Permits Expiring Soon / Expired (amber/red)
   - Confirmed Upcoming Bookings
   - Pending Inquiries

4. UPCOMING EVENTS (next 30 days)
   - List of confirmed bookings in the next 30 days
   - Each shows: date, client name, event type, location, status badge
   - "View All Bookings" link

5. PERMIT EXPIRATION TIMELINE
   - Simple visual: list of permits sorted by expiration date
   - Color-coded: green (>60 days), amber (31-60 days), red (≤30 days)
   - Days remaining shown prominently

6. RECENT DOCUMENTS
   - Last 5 uploaded documents with quick download links

All data pulled from Supabase in real-time. Use loading skeletons while fetching.
Make this dashboard feel like a mission control panel — dense, informative, actionable.
Fire/ember theme throughout.`,
    note: "This is the page to show George first. His reaction to this screen will tell you what to build next."
  },
  {
    step: "08",
    phase: "Deploy",
    timing: "Day 7 — ~30 min",
    title: "Deploy to Vercel",
    description: "Get it live on a real URL so George can use it from his phone.",
    prompt: `Help me deploy ZigsOps to Vercel.

Provide:
1. The exact terminal commands to push to GitHub and connect to Vercel
2. A list of all environment variables I need to add in Vercel's dashboard:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - RESEND_API_KEY
   - ALERT_EMAIL
3. Any next.config.js changes needed for production
4. How to set up a custom subdomain (e.g. ops.zigskitchen.com) pointing to Vercel
5. Check for any common deployment errors and fix them

After deployment, also add basic auth protection so only George and I can access it:
- Use Supabase Auth with email/password
- Create a simple login page at /login
- Redirect unauthenticated users to /login
- Only two accounts needed for now`,
    note: "Vercel free tier is plenty. Connect your GitHub repo in Vercel dashboard → Import Project. Takes 5 minutes."
  }
];

const schema = {
  tables: [
    {
      name: "permits",
      color: COLORS.fire,
      icon: "🏛️",
      columns: [
        { col: "id", type: "uuid", note: "Primary key, auto-generated" },
        { col: "name", type: "text", note: "e.g. 'PG County Health Permit'" },
        { col: "issuing_agency", type: "text", note: "e.g. 'PG County Health Dept'" },
        { col: "permit_number", type: "text", note: "Official permit number" },
        { col: "issue_date", type: "date", note: "When it was issued" },
        { col: "expiration_date", type: "date", note: "⚠️ Indexed — used for alerts" },
        { col: "status", type: "text", note: "'active' | 'expiring_soon' | 'expired'" },
        { col: "document_url", type: "text", note: "Supabase Storage path" },
        { col: "notes", type: "text", note: "Free-form notes" },
        { col: "reminder_sent", type: "boolean", note: "Flipped to true after email sent" },
        { col: "created_at", type: "timestamptz", note: "Auto-set on insert" },
      ]
    },
    {
      name: "bookings",
      color: COLORS.gold,
      icon: "📋",
      columns: [
        { col: "id", type: "uuid", note: "Primary key" },
        { col: "client_name", type: "text", note: "Who booked" },
        { col: "client_email", type: "text", note: "" },
        { col: "client_phone", type: "text", note: "" },
        { col: "event_date", type: "date", note: "⚠️ Indexed" },
        { col: "event_time", type: "text", note: "e.g. '6:00 PM'" },
        { col: "event_location", type: "text", note: "Full address" },
        { col: "event_type", type: "text", note: "'catering' | 'food_truck' | 'pop_up'" },
        { col: "guest_count", type: "integer", note: "" },
        { col: "status", type: "text", note: "'inquiry' | 'quoted' | 'confirmed' | 'completed' | 'cancelled'" },
        { col: "package_description", type: "text", note: "Menu / service details" },
        { col: "quote_amount", type: "decimal", note: "Total quote $" },
        { col: "deposit_amount", type: "decimal", note: "Deposit required $" },
        { col: "deposit_paid", type: "boolean", note: "Default false" },
        { col: "notes", type: "text", note: "Internal notes" },
        { col: "created_at", type: "timestamptz", note: "Auto-set" },
      ]
    },
    {
      name: "documents",
      color: "#4A9E6B",
      icon: "📁",
      columns: [
        { col: "id", type: "uuid", note: "Primary key" },
        { col: "name", type: "text", note: "Display name" },
        { col: "category", type: "text", note: "'insurance' | 'permit' | 'commissary' | 'license' | 'certification' | 'contract' | 'other'" },
        { col: "file_url", type: "text", note: "Supabase Storage URL" },
        { col: "file_name", type: "text", note: "Original filename" },
        { col: "expiration_date", type: "date", note: "Nullable — ⚠️ Indexed" },
        { col: "notes", type: "text", note: "" },
        { col: "created_at", type: "timestamptz", note: "Auto-set" },
      ]
    }
  ],
  storageBuckets: [
    { name: "permit-docs", access: "authenticated", notes: "Permit certificate PDFs/images" },
    { name: "business-docs", access: "authenticated", notes: "Insurance certs, licenses, agreements" },
  ],
  envVars: [
    { key: "NEXT_PUBLIC_SUPABASE_URL", where: "Supabase → Project Settings → API" },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", where: "Supabase → Project Settings → API" },
    { key: "SUPABASE_SERVICE_ROLE_KEY", where: "Supabase → Project Settings → API (secret)" },
    { key: "RESEND_API_KEY", where: "resend.com → API Keys" },
    { key: "ALERT_EMAIL", where: "George's email address" },
  ]
};

// ─── UI MOCKUP ────────────────────────────────────────────────────────────────

function Badge({ label, color }) {
  return (
    <span style={{
      background: color + "22",
      color: color,
      border: `1px solid ${color}44`,
      borderRadius: 4,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      whiteSpace: "nowrap"
    }}>{label}</span>
  );
}

function PermitRow({ name, agency, expires, daysLeft, status }) {
  const statusColor = status === "active" ? "#4A9E6B" : status === "expiring" ? COLORS.gold : "#E84040";
  const statusLabel = status === "active" ? "Active" : status === "expiring" ? "Expiring Soon" : "Expired";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 160px 120px 90px",
      gap: 12,
      padding: "12px 16px",
      borderBottom: `1px solid ${COLORS.ash}33`,
      alignItems: "center",
      fontSize: 13,
    }}>
      <div>
        <div style={{ color: COLORS.cream, fontWeight: 600 }}>{name}</div>
        <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>{agency}</div>
      </div>
      <div style={{ color: COLORS.muted }}>{expires}</div>
      <div style={{ color: daysLeft <= 30 ? "#E84040" : daysLeft <= 60 ? COLORS.gold : "#4A9E6B", fontWeight: 700 }}>
        {daysLeft > 0 ? `${daysLeft} days` : "EXPIRED"}
      </div>
      <Badge label={statusLabel} color={statusColor} />
    </div>
  );
}

function BookingCard({ client, date, type, guests, amount, stage }) {
  const stageColor = stage === "confirmed" ? "#4A9E6B" : stage === "quoted" ? COLORS.gold : COLORS.muted;
  return (
    <div style={{
      background: COLORS.smoke,
      border: `1px solid ${COLORS.ash}55`,
      borderRadius: 8,
      padding: "12px 14px",
      marginBottom: 8,
      cursor: "pointer",
      transition: "border-color 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ color: COLORS.cream, fontWeight: 700, fontSize: 13 }}>{client}</div>
        <Badge label={type} color={COLORS.fire} />
      </div>
      <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{date}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
        <span style={{ color: COLORS.muted }}>{guests} guests</span>
        <span style={{ color: COLORS.gold, fontWeight: 700 }}>${amount}</span>
      </div>
    </div>
  );
}

function Sidebar({ activeSection, setActiveSection }) {
  const navItems = [
    { id: "dashboard", icon: "⬛", label: "Dashboard" },
    { id: "permits", icon: "🏛️", label: "Permits" },
    { id: "bookings", icon: "📋", label: "Bookings" },
    { id: "documents", icon: "📁", label: "Documents" },
  ];
  return (
    <div style={{
      width: 200,
      background: COLORS.smoke,
      borderRight: `1px solid ${COLORS.ash}44`,
      padding: "24px 0",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      <div style={{ padding: "0 20px 24px", borderBottom: `1px solid ${COLORS.ash}44` }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.fire, fontFamily: "Georgia, serif", lineHeight: 1.2 }}>
          Zig's Kitchen
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Ops Dashboard
        </div>
      </div>
      <nav style={{ padding: "16px 0", flex: 1 }}>
        {navItems.map(item => (
          <button key={item.id}
            onClick={() => setActiveSection(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 20px",
              background: activeSection === item.id ? `${COLORS.fire}22` : "transparent",
              borderLeft: activeSection === item.id ? `3px solid ${COLORS.fire}` : "3px solid transparent",
              color: activeSection === item.id ? COLORS.cream : COLORS.muted,
              border: "none", borderLeft: activeSection === item.id ? `3px solid ${COLORS.fire}` : "3px solid transparent",
              cursor: "pointer", fontSize: 13, fontWeight: activeSection === item.id ? 700 : 400,
              textAlign: "left", transition: "all 0.15s",
            }}>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${COLORS.ash}44` }}>
        <div style={{ fontSize: 11, color: COLORS.muted }}>Logged in as</div>
        <div style={{ fontSize: 12, color: COLORS.cream, marginTop: 2 }}>George Zigler</div>
      </div>
    </div>
  );
}

function DashboardView() {
  return (
    <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.cream, fontFamily: "Georgia, serif" }}>Good morning, Zig's 🔥</div>
          <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 2 }}>Friday, March 20, 2026</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["+ Permit", "+ Booking", "+ Upload"].map(a => (
            <button key={a} style={{
              background: COLORS.fire, color: COLORS.cream, border: "none",
              borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer"
            }}>{a}</button>
          ))}
        </div>
      </div>

      {/* Alert Banner */}
      <div style={{
        background: `${COLORS.fire}22`, border: `1px solid ${COLORS.fire}66`,
        borderRadius: 8, padding: "12px 16px", marginBottom: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ color: COLORS.fire, fontWeight: 700, fontSize: 13 }}>
          ⚠️ Action Required: 2 permits expiring within 30 days
        </div>
        <span style={{ color: COLORS.fire, fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>View Permits →</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Active Permits", value: "7", color: "#4A9E6B" },
          { label: "Expiring / Expired", value: "2", color: COLORS.fire },
          { label: "Confirmed Events", value: "4", color: COLORS.gold },
          { label: "Pending Inquiries", value: "3", color: COLORS.muted },
        ].map(stat => (
          <div key={stat.label} style={{
            background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`,
            borderRadius: 8, padding: "16px",
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Upcoming Events */}
        <div style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.cream, marginBottom: 12 }}>Upcoming Events (30 days)</div>
          {[
            { client: "Johnson Wedding Reception", date: "Mar 28", type: "Catering", guests: 120, amount: "3,200", stage: "confirmed" },
            { client: "Howard U Graduation Cookout", date: "Apr 5", type: "Food Truck", guests: 200, amount: "1,800", stage: "confirmed" },
            { client: "DMV Tech Summit", date: "Apr 12", type: "Catering", guests: 80, amount: "2,400", stage: "quoted" },
          ].map((b, i) => <BookingCard key={i} {...b} />)}
        </div>

        {/* Permit Status */}
        <div style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.cream, marginBottom: 12 }}>Permit Status</div>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 100px 70px 100px",
            padding: "0 16px 8px", fontSize: 11, color: COLORS.muted,
            textTransform: "uppercase", letterSpacing: "0.06em"
          }}>
            <span>Permit</span><span>Expires</span><span>Days</span><span>Status</span>
          </div>
          <PermitRow name="Health Permit" agency="PG County Health" expires="Apr 15, 2026" daysLeft={26} status="expiring" />
          <PermitRow name="Business License" agency="PG County" expires="Apr 30, 2026" daysLeft={41} status="expiring" />
          <PermitRow name="Food Manager Cert" agency="ServSafe" expires="Dec 1, 2027" daysLeft={621} status="active" />
          <PermitRow name="General Liability Ins." agency="State Farm" expires="Jan 1, 2027" daysLeft={287} status="active" />
        </div>
      </div>
    </div>
  );
}

function PermitsView() {
  return (
    <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.cream, fontFamily: "Georgia, serif" }}>Permits & Licenses</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ background: COLORS.ash, color: COLORS.cream, border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
            PG County Checklist
          </button>
          <button style={{ background: COLORS.fire, color: COLORS.cream, border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            + Add Permit
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[["7", "Active", "#4A9E6B"], ["2", "Expiring Soon", COLORS.gold], ["0", "Expired", COLORS.muted]].map(([v, l, c]) => (
          <div key={l} style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 8 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 160px 120px 90px 80px",
          padding: "10px 16px", fontSize: 11, color: COLORS.muted,
          textTransform: "uppercase", letterSpacing: "0.06em",
          borderBottom: `1px solid ${COLORS.ash}44`
        }}>
          <span>Permit</span><span>Expires</span><span>Days Left</span><span>Status</span><span></span>
        </div>
        {[
          { name: "PG County Mobile Food License", agency: "PG County Health Dept", expires: "Apr 15, 2026", daysLeft: 26, status: "expiring" },
          { name: "Business License", agency: "Prince George's County", expires: "Apr 30, 2026", daysLeft: 41, status: "expiring" },
          { name: "Commissary Agreement", agency: "Capital Kitchen Co.", expires: "Jun 1, 2026", daysLeft: 73, status: "active" },
          { name: "Food Manager Certification", agency: "ServSafe / National Registry", expires: "Dec 1, 2027", daysLeft: 621, status: "active" },
          { name: "General Liability Insurance", agency: "State Farm", expires: "Jan 1, 2027", daysLeft: 287, status: "active" },
          { name: "Commercial Auto Insurance", agency: "Progressive Commercial", expires: "Mar 1, 2027", daysLeft: 346, status: "active" },
          { name: "MD State Sales Tax License", agency: "Comptroller of Maryland", expires: "N/A", daysLeft: 9999, status: "active" },
        ].map((p, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "1fr 160px 120px 90px 80px",
            gap: 12, padding: "12px 16px",
            borderBottom: `1px solid ${COLORS.ash}22`,
            alignItems: "center", fontSize: 13,
          }}>
            <div>
              <div style={{ color: COLORS.cream, fontWeight: 600 }}>{p.name}</div>
              <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>{p.agency}</div>
            </div>
            <div style={{ color: COLORS.muted }}>{p.expires}</div>
            <div style={{ color: p.daysLeft <= 30 ? "#E84040" : p.daysLeft <= 60 ? COLORS.gold : "#4A9E6B", fontWeight: 700 }}>
              {p.daysLeft < 9999 ? `${p.daysLeft} days` : "Permanent"}
            </div>
            <Badge label={p.status === "active" ? "Active" : "Expiring"} color={p.status === "active" ? "#4A9E6B" : COLORS.gold} />
            <button style={{ background: "transparent", border: `1px solid ${COLORS.ash}`, color: COLORS.muted, borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingsView() {
  const stages = ["Inquiry", "Quoted", "Confirmed", "Completed"];
  const bookings = {
    Inquiry: [
      { client: "Smith Family Reunion", date: "May 20", type: "Catering", guests: 75, amount: "1,800" },
      { client: "PG County Church Picnic", date: "May 31", type: "Food Truck", guests: 150, amount: "?" },
      { client: "Bowie State Graduation", date: "Jun 14", type: "Catering", guests: 200, amount: "?" },
    ],
    Quoted: [
      { client: "DMV Tech Summit", date: "Apr 12", type: "Catering", guests: 80, amount: "2,400" },
      { client: "Andrews Airforce Base Event", date: "Apr 19", type: "Food Truck", guests: 300, amount: "2,100" },
    ],
    Confirmed: [
      { client: "Johnson Wedding Reception", date: "Mar 28", type: "Catering", guests: 120, amount: "3,200" },
      { client: "Howard U Graduation", date: "Apr 5", type: "Food Truck", guests: 200, amount: "1,800" },
    ],
    Completed: [
      { client: "Suitland HS Prom", date: "Mar 1", type: "Catering", guests: 180, amount: "4,100" },
    ],
  };

  return (
    <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.cream, fontFamily: "Georgia, serif" }}>Catering Pipeline</div>
        <button style={{ background: COLORS.fire, color: COLORS.cream, border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          + New Inquiry
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "start" }}>
        {stages.map(stage => (
          <div key={stage}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", marginBottom: 8,
              background: COLORS.ash + "44", borderRadius: 6,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stage}</span>
              <span style={{ fontSize: 11, color: COLORS.muted, background: COLORS.ash, borderRadius: 10, padding: "1px 7px" }}>
                {(bookings[stage] || []).length}
              </span>
            </div>
            {(bookings[stage] || []).map((b, i) => <BookingCard key={i} {...b} stage={stage.toLowerCase()} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsView() {
  const docs = [
    { name: "PG County Health Permit 2025", cat: "Permit", catColor: COLORS.fire, date: "Mar 1, 2025", expires: "Apr 15, 2026", icon: "📄" },
    { name: "General Liability Insurance Cert", cat: "Insurance", catColor: "#4A7FE8", date: "Jan 15, 2026", expires: "Jan 1, 2027", icon: "📄" },
    { name: "Capital Kitchen Commissary Agmt", cat: "Commissary", catColor: "#4A9E6B", date: "Jun 1, 2025", expires: "Jun 1, 2026", icon: "📄" },
    { name: "Business License 2026", cat: "License", catColor: COLORS.gold, date: "Jan 2, 2026", expires: "Apr 30, 2026", icon: "📄" },
    { name: "ServSafe Manager Certificate", cat: "Certification", catColor: "#9E4AE8", date: "Dec 1, 2022", expires: "Dec 1, 2027", icon: "📄" },
    { name: "Vehicle Registration — Truck 1", cat: "License", catColor: COLORS.gold, date: "Feb 1, 2026", expires: "Feb 1, 2027", icon: "📄" },
  ];

  return (
    <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.cream, fontFamily: "Georgia, serif" }}>Document Vault</div>
        <button style={{ background: COLORS.fire, color: COLORS.cream, border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          + Upload Document
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {docs.map((doc, i) => (
          <div key={i} style={{
            background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`,
            borderRadius: 8, padding: 16, cursor: "pointer",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{doc.icon}</span>
              <Badge label={doc.cat} color={doc.catColor} />
            </div>
            <div style={{ color: COLORS.cream, fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{doc.name}</div>
            <div style={{ color: COLORS.muted, fontSize: 11 }}>Uploaded {doc.date}</div>
            {doc.expires && (
              <div style={{ color: COLORS.gold, fontSize: 11, marginTop: 4 }}>Expires {doc.expires}</div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <button style={{ background: COLORS.ash, color: COLORS.cream, border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>View</button>
              <button style={{ background: "transparent", border: `1px solid ${COLORS.ash}`, color: COLORS.muted, borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Download</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────

export default function ZigsOpsBuildGuide() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [copiedIdx, setCopiedIdx] = useState(null);

  const copyPrompt = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: COLORS.coal,
      color: COLORS.cream,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: COLORS.smoke,
        borderBottom: `1px solid ${COLORS.ash}66`,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.fire, fontFamily: "Georgia, serif" }}>
            ZigsOps Build Guide
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
            Claude Code prompts · Supabase schema · UI reference — start to deploy
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: COLORS.coal, borderRadius: 8, padding: 4 }}>
          {tabs.map((tab, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{
              padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer",
              background: activeTab === i ? COLORS.fire : "transparent",
              color: activeTab === i ? COLORS.cream : COLORS.muted,
              fontSize: 13, fontWeight: activeTab === i ? 700 : 400,
              transition: "all 0.15s",
            }}>{tab}</button>
          ))}
        </div>
      </div>

      {/* Tab: Claude Code Prompts */}
      {activeTab === 0 && (
        <div style={{ padding: 24, overflowY: "auto", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <div style={{ marginBottom: 20, padding: 16, background: `${COLORS.gold}11`, border: `1px solid ${COLORS.gold}33`, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: COLORS.gold, marginBottom: 4 }}>How to use these prompts</div>
            <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.7 }}>
              Run them <strong style={{ color: COLORS.cream }}>in order</strong>, one at a time, inside Claude Code (VS Code terminal or claude.ai). Each prompt builds on the last. Copy the full prompt → paste into Claude Code → wait for it to finish → test → then move to the next.
            </div>
          </div>
          {prompts.map((p, i) => (
            <div key={i} style={{
              background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`,
              borderRadius: 10, marginBottom: 16, overflow: "hidden"
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 20px", borderBottom: `1px solid ${COLORS.ash}33`,
                background: `${COLORS.ash}22`
              }}>
                <span style={{
                  background: COLORS.fire, color: COLORS.cream,
                  borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 800,
                  fontFamily: "monospace"
                }}>STEP {p.step}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.cream }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{p.phase} · {p.timing}</div>
                </div>
                <button
                  onClick={() => copyPrompt(p.prompt, i)}
                  style={{
                    background: copiedIdx === i ? "#4A9E6B" : COLORS.coal,
                    color: COLORS.cream, border: `1px solid ${COLORS.ash}`,
                    borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer",
                    transition: "background 0.2s", fontWeight: 600,
                  }}>
                  {copiedIdx === i ? "✓ Copied!" : "Copy Prompt"}
                </button>
              </div>
              <div style={{ padding: "14px 20px" }}>
                <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12, lineHeight: 1.6 }}>{p.description}</p>
                <pre style={{
                  background: COLORS.coal, borderRadius: 8, padding: 16,
                  fontSize: 12, color: "#A8D8A0", lineHeight: 1.7,
                  overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  border: `1px solid ${COLORS.ash}33`,
                  maxHeight: 280, overflowY: "auto"
                }}>{p.prompt}</pre>
                {p.note && (
                  <div style={{
                    marginTop: 10, padding: "10px 14px",
                    background: `${COLORS.gold}11`, border: `1px solid ${COLORS.gold}33`,
                    borderRadius: 6, fontSize: 12, color: COLORS.gold,
                  }}>
                    💡 <strong>After this step:</strong> {p.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Supabase Schema */}
      {activeTab === 1 && (
        <div style={{ padding: 24, overflowY: "auto", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.cream, marginBottom: 4 }}>Database Tables</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>3 tables, 2 storage buckets. Paste Step 02 prompt into Claude Code to get the full SQL, then run it in Supabase → SQL Editor.</div>
          </div>

          {schema.tables.map((table, ti) => (
            <div key={ti} style={{
              background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`,
              borderRadius: 10, marginBottom: 16, overflow: "hidden"
            }}>
              <div style={{
                padding: "12px 20px", background: `${table.color}22`,
                borderBottom: `1px solid ${table.color}44`,
                display: "flex", alignItems: "center", gap: 10
              }}>
                <span style={{ fontSize: 18 }}>{table.icon}</span>
                <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: table.color }}>
                  {table.name}
                </span>
                <span style={{ fontSize: 12, color: COLORS.muted }}>({table.columns.length} columns)</span>
              </div>
              <div>
                <div style={{
                  display: "grid", gridTemplateColumns: "160px 120px 1fr",
                  padding: "8px 20px", fontSize: 11, color: COLORS.muted,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  borderBottom: `1px solid ${COLORS.ash}22`
                }}>
                  <span>Column</span><span>Type</span><span>Notes</span>
                </div>
                {table.columns.map((col, ci) => (
                  <div key={ci} style={{
                    display: "grid", gridTemplateColumns: "160px 120px 1fr",
                    padding: "9px 20px", fontSize: 13,
                    borderBottom: `1px solid ${COLORS.ash}22`,
                    background: ci % 2 === 0 ? "transparent" : `${COLORS.ash}11`
                  }}>
                    <span style={{ fontFamily: "monospace", color: table.color, fontWeight: 600 }}>{col.col}</span>
                    <span style={{ fontFamily: "monospace", color: COLORS.muted, fontSize: 12 }}>{col.type}</span>
                    <span style={{ color: COLORS.muted, fontSize: 12 }}>{col.note}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
            <div style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 20px", background: `${COLORS.muted}22`, borderBottom: `1px solid ${COLORS.ash}44`, fontSize: 13, fontWeight: 700, color: COLORS.cream }}>
                🗄️ Storage Buckets
              </div>
              {schema.storageBuckets.map((b, i) => (
                <div key={i} style={{ padding: "12px 20px", borderBottom: `1px solid ${COLORS.ash}22`, fontSize: 13 }}>
                  <div style={{ fontFamily: "monospace", color: COLORS.gold, fontWeight: 700 }}>{b.name}</div>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>{b.notes}</div>
                  <Badge label={b.access} color={COLORS.muted} />
                </div>
              ))}
            </div>
            <div style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 20px", background: `${COLORS.muted}22`, borderBottom: `1px solid ${COLORS.ash}44`, fontSize: 13, fontWeight: 700, color: COLORS.cream }}>
                🔑 Environment Variables
              </div>
              {schema.envVars.map((v, i) => (
                <div key={i} style={{ padding: "10px 20px", borderBottom: `1px solid ${COLORS.ash}22`, fontSize: 12 }}>
                  <div style={{ fontFamily: "monospace", color: COLORS.fire, fontWeight: 700 }}>{v.key}</div>
                  <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>{v.where}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: UI Mockup */}
      {activeTab === 2 && (
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 16, fontSize: 13, color: COLORS.muted }}>
            Live UI preview — click the sidebar to navigate between screens. This is your design reference while building.
          </div>
          <div style={{
            display: "flex",
            border: `1px solid ${COLORS.ash}44`,
            borderRadius: 12,
            overflow: "hidden",
            height: 620,
            background: COLORS.coal,
          }}>
            <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
            <div style={{ flex: 1, overflowY: "auto" }}>
              {activeSection === "dashboard" && <DashboardView />}
              {activeSection === "permits" && <PermitsView />}
              {activeSection === "bookings" && <BookingsView />}
              {activeSection === "documents" && <DocumentsView />}
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted, textAlign: "center" }}>
            UI mockup reflects real Zig's Kitchen data structure · Fire/ember theme · All screens interactive
          </div>
        </div>
      )}
    </div>
  );
}
