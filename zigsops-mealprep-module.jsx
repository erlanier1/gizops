import { useState } from "react";

const COLORS = {
  fire: "#E8521A",
  ember: "#C93B0A",
  coal: "#1A1008",
  smoke: "#2D2416",
  ash: "#4A3D2E",
  cream: "#F5EDD9",
  gold: "#D4A84B",
  muted: "#8A7560",
  green: "#4A9E6B",
  blue: "#4A7FE8",
  purple: "#9E4AE8",
  teal: "#2AA8A0",
};

const tabs = ["Claude Code Prompts", "Database Schema", "UI Preview"];

// ─── PROMPTS ──────────────────────────────────────────────────────────────────

const prompts = [
  {
    step: "09",
    phase: "Database — Meal Prep Tables",
    timing: "30 min",
    title: "Add Meal Prep Schema to Supabase",
    description: "Run this in Supabase SQL Editor to add the 4 new tables needed for meal prep tracking.",
    prompt: `Add the following tables to the existing ZigsOps Supabase database for a Meal Prep Plans module.

-- 1. MEAL PREP CLIENTS
-- Tracks individual customers and daycare/business accounts separately
CREATE TABLE meal_prep_clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_type text NOT NULL CHECK (client_type IN ('individual', 'daycare', 'business')),
  name text NOT NULL,
  contact_name text,               -- For daycares: director or billing contact
  email text,
  phone text,
  address text,
  delivery_instructions text,
  dietary_notes text,              -- Allergies, restrictions, preferences
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. MEAL PLANS
-- The plan template (what they get, how often, at what price)
CREATE TABLE meal_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES meal_prep_clients(id) ON DELETE CASCADE,
  plan_name text NOT NULL,         -- e.g. "Family Weekly Box", "Daycare Lunch Program"
  plan_type text NOT NULL CHECK (plan_type IN ('weekly', 'biweekly', 'monthly', 'custom')),
  servings_per_delivery integer,   -- How many meals per delivery
  meals_per_week integer,          -- How many deliveries per week (daycares: 5)
  price_per_delivery numeric(10,2),
  price_per_month numeric(10,2),   -- Calculated or manually set
  delivery_days text[],            -- e.g. ['monday', 'wednesday', 'friday']
  delivery_time text,              -- e.g. "7:00 AM"
  pickup_or_delivery text CHECK (pickup_or_delivery IN ('pickup', 'delivery')),
  menu_notes text,                 -- What's typically included
  start_date date,
  end_date date,                   -- NULL = ongoing
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- 3. MEAL PREP DELIVERIES
-- Each individual delivery/fulfillment event
CREATE TABLE meal_prep_deliveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid REFERENCES meal_plans(id) ON DELETE CASCADE,
  client_id uuid REFERENCES meal_prep_clients(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  servings_delivered integer,
  menu_description text,           -- What was actually prepared this delivery
  delivery_status text DEFAULT 'scheduled' CHECK (
    delivery_status IN ('scheduled', 'prepared', 'delivered', 'missed', 'cancelled')
  ),
  delivery_notes text,
  amount_due numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- 4. MEAL PREP PAYMENTS
-- Payment records tied to a client (may cover multiple deliveries)
CREATE TABLE meal_prep_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES meal_prep_clients(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES meal_plans(id),
  payment_date date NOT NULL,
  amount numeric(10,2) NOT NULL,
  payment_method text CHECK (
    payment_method IN ('cash', 'zelle', 'venmo', 'cashapp', 'check', 'card', 'invoice')
  ),
  period_start date,               -- What billing period this covers
  period_end date,
  status text DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'partial', 'overdue', 'refunded')),
  notes text,
  reference_number text,           -- Check number, Zelle confirmation, etc.
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_meal_plans_client ON meal_plans(client_id);
CREATE INDEX idx_deliveries_date ON meal_prep_deliveries(delivery_date);
CREATE INDEX idx_deliveries_plan ON meal_prep_deliveries(plan_id);
CREATE INDEX idx_payments_client ON meal_prep_payments(client_id);
CREATE INDEX idx_payments_status ON meal_prep_payments(status);

-- RLS: allow all for authenticated users
ALTER TABLE meal_prep_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_prep_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_prep_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON meal_prep_clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON meal_plans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON meal_prep_deliveries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON meal_prep_payments FOR ALL USING (auth.role() = 'authenticated');`,
    note: "Run this SQL in Supabase → SQL Editor → New Query. It adds 4 new tables without touching your existing permits/bookings/documents tables."
  },
  {
    step: "10",
    phase: "Meal Prep Module — Core UI",
    timing: "3–4 hours",
    title: "Build the Meal Prep Clients & Plans Pages",
    description: "The main meal prep section: client list, plan setup, and delivery schedule view.",
    prompt: `Add a Meal Prep module to ZigsOps at app/meal-prep/page.tsx.

This module tracks recurring meal prep plans for two types of customers:
- Individual families (weekly meal boxes, custom plans)
- Daycare facilities (daily lunch programs, 5-day/week delivery)

BUILD THESE VIEWS:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIEW 1: CLIENT LIST (default tab)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Card grid of all meal prep clients
- Each card shows:
  * Client name + type badge (Individual / Daycare / Business)
  * Active plan name
  * Next delivery date
  * Balance: amount owed vs paid this month
  * Quick "Log Payment" button
- Filter tabs: All | Individuals | Daycares | Overdue
- "Add Client" button

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIEW 2: ADD/EDIT CLIENT (modal)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Client type selector: Individual / Daycare / Business
- When "Daycare" selected: show extra fields:
  * Facility name
  * Director/contact name
  * Number of children being served
  * License number (optional)
- Standard fields: email, phone, address, delivery instructions
- Dietary notes textarea (allergies, restrictions)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIEW 3: CLIENT DETAIL PAGE (app/meal-prep/[id]/page.tsx)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Header: client name, type, contact info, dietary notes
Tabs within the page:
  [Plan] [Deliveries] [Payments] [Notes]

PLAN TAB:
- Show active plan details
- Plan name, type (weekly/biweekly/monthly), servings, price
- Delivery days (checkboxes: Mon–Sun)
- Pickup or delivery toggle
- Start date, end date (optional)
- "Edit Plan" and "Pause Plan" buttons

DELIVERIES TAB:
- Table of all delivery records for this client
- Columns: Date, Servings, Menu, Status, Amount Due
- Status badges: Scheduled (gray), Prepared (blue), Delivered (green), Missed (red)
- "Add Delivery" button
- "Mark as Delivered" quick action per row

PAYMENTS TAB:
- Payment history table
- Columns: Date, Amount, Method, Period Covered, Status, Reference #
- Running balance: Total charged this month vs Total paid
- Overdue balance highlighted in red if > 0
- "Log Payment" button (opens modal)
- "Send Payment Reminder" button (sends email via Resend)

Use Supabase for all data. Match fire/ember theme. Handle loading and empty states.`,
    note: "Add your first test client — either a real Zig's Kitchen meal prep customer or a test 'Johnson Family' individual client."
  },
  {
    step: "11",
    phase: "Payment Logging & Balance Tracker",
    timing: "2 hours",
    title: "Build the Payment Log & Balance Dashboard",
    description: "The money view — who owes what, what's been paid, and the monthly revenue summary.",
    prompt: `Build the Payments sub-section of the Meal Prep module in ZigsOps.

CREATE TWO COMPONENTS:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT 1: LOG PAYMENT MODAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fields:
- Client selector (dropdown, pre-filled if opened from client page)
- Payment date (default: today)
- Amount (with $ formatting, auto-suggest: their monthly plan price)
- Payment method: Cash | Zelle | Venmo | CashApp | Check | Card | Invoice
- Period covered: start date → end date (default: current billing period)
- Reference number (optional: check #, Zelle confirmation, etc.)
- Status: Paid | Partial | Pending
- Notes

After saving:
- Insert to meal_prep_payments table
- Recalculate client's balance
- Show success toast: "Payment of $X logged for [client name]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPONENT 2: MEAL PREP PAYMENTS OVERVIEW PAGE
at app/meal-prep/payments/page.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOP STATS ROW:
- Monthly Revenue (sum of paid payments this month)
- Outstanding Balance (sum of all overdue/pending across all clients)
- Deliveries This Month (count)
- Active Plans (count of active meal_plans)

OVERDUE ALERTS:
- List of clients with outstanding balances > 0
- Show: client name, amount owed, days overdue
- "Send Reminder" button per client
- Overdue = any payment with status 'overdue' OR deliveries with amount_due but no corresponding payment in same period

FULL PAYMENTS TABLE:
- All payments across all clients, newest first
- Columns: Date, Client, Amount, Method, Period, Status
- Filter: All | This Month | Overdue | By Client
- Export to CSV button (generates downloadable file)

MONTHLY REVENUE CHART:
- Simple bar chart using recharts
- Last 6 months of meal prep revenue
- Separate bars for: Individuals vs Daycares

Use Supabase queries with joins across meal_prep_payments, meal_prep_clients, and meal_plans.
All data real-time. Fire/ember theme.`,
    note: "The CSV export is critical — George will want to reconcile this with his actual bank account."
  },
  {
    step: "12",
    phase: "Delivery Schedule View",
    timing: "1.5 hours",
    title: "Build the Weekly Delivery Schedule",
    description: "A calendar-style view showing what needs to be prepped and delivered each day.",
    prompt: `Build a weekly delivery schedule view for the Meal Prep module in ZigsOps.

File: app/meal-prep/schedule/page.tsx

This is the "prep day" view — George opens this to see exactly what he needs to cook and deliver.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT: WEEK VIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 7-column grid (Mon–Sun) showing current week
- Previous/Next week navigation arrows
- "Today" button to jump back to current week

Each day column shows:
- Day of week + date
- Total servings to prepare that day
- List of delivery cards (one per client scheduled)

Each delivery card shows:
- Client name + type badge
- Servings count (large, prominent)
- Delivery time
- Pickup or delivery icon
- Menu notes
- Status: Scheduled → Prepared → Delivered
- One-click status update buttons

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PREP SUMMARY SIDEBAR (right panel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For the selected day, show:
- Total servings: [X]
- Breakdown by client type: X individual, X daycare
- List of all dietary restrictions across today's clients
  (pulled from client dietary_notes — critical for food safety)
- Estimated revenue for the day

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-GENERATE DELIVERIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add a "Generate This Week's Schedule" button that:
- Looks at all active meal_plans
- Creates meal_prep_delivery records for each delivery_day in the plan
- For the current week only
- Skips days that already have a delivery record
- Shows a confirmation: "Generated X deliveries for this week"

This means George doesn't manually enter every delivery — the system creates them from the plan template.

Query logic:
- Get all active plans WHERE status = 'active'
- For each plan, check plan.delivery_days array
- Create delivery records for matching days of current week
- Set delivery_status = 'scheduled', amount_due = plan.price_per_delivery

Use Supabase. Match fire/ember theme. Make the schedule feel like a production prep sheet.`,
    note: "This is the screen George will use every Sunday night to prep for the week. It's the highest-value daily-use screen in the module."
  },
  {
    step: "13",
    phase: "Payment Reminder Emails",
    timing: "45 min",
    title: "Add Meal Prep Payment Reminder Emails",
    description: "Automated and manual payment reminders via Resend, tied to the overdue tracker.",
    prompt: `Add meal prep payment reminder email functionality to ZigsOps.

File: app/api/send-payment-reminder/route.ts

1. API ROUTE: POST /api/send-payment-reminder
   - Accepts: { clientId, amount, periodStart, periodEnd }
   - Fetches client details from meal_prep_clients
   - Fetches their active plan from meal_plans
   - Sends a professional reminder email via Resend

2. EMAIL TEMPLATE (HTML):
   Subject: "Payment Reminder — Zig's Kitchen Meal Prep 🍽️"
   
   Design the email with:
   - Header: "Zig's Kitchen & Catering" in fire orange
   - Body: "Hi [client name], this is a friendly reminder that your meal prep payment is due."
   - Payment details table:
     * Plan: [plan name]
     * Period: [start] – [end]
     * Amount Due: $[amount]
   - Payment methods section:
     * Zelle: [George's phone/email]
     * Venmo: @ziggs-kitchen (placeholder)
     * Cash: Contact us to arrange
   - Footer with Zig's Kitchen contact info
   - Warm, professional tone — not debt-collector tone

3. AUTO-REMINDER LOGIC (add to existing /api/check-permits route OR create separate cron):
   - Check for meal_prep_payments where:
     * status = 'overdue' OR
     * status = 'pending' AND period_end < today - 3 days
   - Send reminder email for each
   - Log a note in the payment record: "Reminder sent [date]"
   - Don't send more than 1 reminder per client per week

4. UI: "Send Reminder" button on:
   - Client detail page → Payments tab
   - Payments overview page → Overdue list
   - Should show: last reminder sent date next to each overdue client

Use RESEND_API_KEY from env. Match Zig's Kitchen fire/ember branding in the email.`,
    note: "Test by sending yourself a reminder first. Update the Zelle/Venmo details to George's real payment handles."
  },
  {
    step: "14",
    phase: "Dashboard Integration",
    timing: "30 min",
    title: "Add Meal Prep Stats to Main Dashboard",
    description: "Surface meal prep revenue and overdue alerts on the main ZigsOps dashboard.",
    prompt: `Update the main ZigsOps dashboard (app/page.tsx) to include meal prep data.

ADD TO EXISTING DASHBOARD:

1. NEW STATS CARDS (add to existing stats row or create a second row):
   - "Meal Prep Revenue This Month" (sum of paid meal_prep_payments this month)
   - "Overdue Balances" (count of clients with overdue payments — link to meal-prep/payments)
   - "Active Meal Plans" (count of plans with status = 'active')
   - "Deliveries This Week" (count of scheduled deliveries this week)

2. ALERT BANNER (add to existing alert system):
   - If any meal prep clients have overdue balances: 
     "💰 [X] meal prep clients have outstanding balances — $[total] overdue"
   - Amber color, links to /meal-prep/payments

3. TODAY'S DELIVERIES WIDGET:
   - New section below existing "Upcoming Events"
   - Shows today's meal prep deliveries
   - Each row: client name, servings, time, status
   - "View Full Schedule" link → /meal-prep/schedule

4. QUICK STATS SIDEBAR CARD:
   - "This Week's Meal Prep"
   - Total servings: [X]
   - Clients served: [X]  
   - Revenue expected: $[X]
   - Revenue collected: $[X]

Update the sidebar nav to include:
  🍱 Meal Prep  (between Bookings and Documents)
  With sub-items that expand:
    → Clients
    → Schedule
    → Payments

All queries should be efficient — use Promise.all() to fetch dashboard data in parallel.`,
    note: "After this step, the dashboard gives George a complete business picture in one screen: permits, catering pipeline, AND meal prep revenue."
  }
];

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

const schemaData = {
  tables: [
    {
      name: "meal_prep_clients",
      color: COLORS.teal,
      icon: "👤",
      description: "Individual families and daycare/business accounts",
      columns: [
        { col: "id", type: "uuid", note: "Primary key" },
        { col: "client_type", type: "text", note: "'individual' | 'daycare' | 'business'" },
        { col: "name", type: "text", note: "Family name or facility name" },
        { col: "contact_name", type: "text", note: "Daycare director or billing contact" },
        { col: "email", type: "text", note: "" },
        { col: "phone", type: "text", note: "" },
        { col: "address", type: "text", note: "Delivery address" },
        { col: "delivery_instructions", type: "text", note: "Gate codes, drop-off notes" },
        { col: "dietary_notes", type: "text", note: "Allergies, restrictions — shown on prep sheet" },
        { col: "is_active", type: "boolean", note: "Default true" },
        { col: "created_at", type: "timestamptz", note: "Auto-set" },
      ]
    },
    {
      name: "meal_plans",
      color: COLORS.green,
      icon: "📋",
      description: "The recurring plan template for each client",
      columns: [
        { col: "id", type: "uuid", note: "Primary key" },
        { col: "client_id", type: "uuid", note: "→ meal_prep_clients" },
        { col: "plan_name", type: "text", note: "e.g. 'Family Weekly Box'" },
        { col: "plan_type", type: "text", note: "'weekly' | 'biweekly' | 'monthly' | 'custom'" },
        { col: "servings_per_delivery", type: "integer", note: "Meals per delivery" },
        { col: "meals_per_week", type: "integer", note: "Deliveries/week (daycares: 5)" },
        { col: "price_per_delivery", type: "numeric", note: "$ per delivery event" },
        { col: "price_per_month", type: "numeric", note: "Monthly total (manual or calculated)" },
        { col: "delivery_days", type: "text[]", note: "['monday', 'wednesday', 'friday']" },
        { col: "delivery_time", type: "text", note: "e.g. '7:00 AM'" },
        { col: "pickup_or_delivery", type: "text", note: "'pickup' | 'delivery'" },
        { col: "menu_notes", type: "text", note: "What's typically included" },
        { col: "start_date", type: "date", note: "" },
        { col: "end_date", type: "date", note: "NULL = ongoing" },
        { col: "status", type: "text", note: "'active' | 'paused' | 'cancelled'" },
      ]
    },
    {
      name: "meal_prep_deliveries",
      color: COLORS.gold,
      icon: "🍱",
      description: "Each individual delivery/fulfillment event (auto-generated from plans)",
      columns: [
        { col: "id", type: "uuid", note: "Primary key" },
        { col: "plan_id", type: "uuid", note: "→ meal_plans" },
        { col: "client_id", type: "uuid", note: "→ meal_prep_clients (denormalized for speed)" },
        { col: "delivery_date", type: "date", note: "⚠️ Indexed" },
        { col: "servings_delivered", type: "integer", note: "" },
        { col: "menu_description", type: "text", note: "What was actually cooked" },
        { col: "delivery_status", type: "text", note: "'scheduled' | 'prepared' | 'delivered' | 'missed' | 'cancelled'" },
        { col: "delivery_notes", type: "text", note: "" },
        { col: "amount_due", type: "numeric", note: "$ owed for this delivery" },
      ]
    },
    {
      name: "meal_prep_payments",
      color: COLORS.fire,
      icon: "💰",
      description: "Payment records — cash, Zelle, Venmo, check, card",
      columns: [
        { col: "id", type: "uuid", note: "Primary key" },
        { col: "client_id", type: "uuid", note: "→ meal_prep_clients" },
        { col: "plan_id", type: "uuid", note: "→ meal_plans (optional)" },
        { col: "payment_date", type: "date", note: "" },
        { col: "amount", type: "numeric", note: "$ received" },
        { col: "payment_method", type: "text", note: "'cash' | 'zelle' | 'venmo' | 'cashapp' | 'check' | 'card' | 'invoice'" },
        { col: "period_start", type: "date", note: "Billing period start" },
        { col: "period_end", type: "date", note: "Billing period end" },
        { col: "status", type: "text", note: "'paid' | 'pending' | 'partial' | 'overdue' | 'refunded'" },
        { col: "notes", type: "text", note: "" },
        { col: "reference_number", type: "text", note: "Check #, Zelle confirmation, etc." },
      ]
    },
  ],
  businessLogic: [
    {
      title: "Auto-Generate Deliveries",
      icon: "⚡",
      color: COLORS.teal,
      description: "Weekly schedule generates delivery records from plan templates. George clicks 'Generate This Week' every Sunday — system creates all delivery records from active plans."
    },
    {
      title: "Balance Calculation",
      icon: "🧮",
      color: COLORS.gold,
      description: "Per client: sum(amount_due on deliveries in period) minus sum(payments.amount in period) = outstanding balance. Shown prominently on client card."
    },
    {
      title: "Overdue Detection",
      icon: "⚠️",
      color: COLORS.fire,
      description: "A client is overdue if their outstanding balance > 0 AND period_end is more than 3 days ago. Triggers alert banner on dashboard and enables 'Send Reminder' button."
    },
    {
      title: "Dietary Notes on Prep Sheet",
      icon: "🥗",
      color: COLORS.green,
      description: "When viewing the daily schedule, all dietary restrictions/allergies from each client's profile are surfaced in the prep summary — critical for food safety compliance."
    },
  ]
};

// ─── UI PREVIEW ───────────────────────────────────────────────────────────────

function Badge({ label, color, small }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: small ? "1px 6px" : "2px 8px",
      fontSize: small ? 10 : 11, fontWeight: 600,
      letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap"
    }}>{label}</span>
  );
}

const mockClients = [
  { name: "Johnson Family", type: "individual", typeColor: COLORS.teal, plan: "Family Weekly Box (10 meals/wk)", nextDelivery: "Mon Mar 23", balance: 0, paid: 280, due: 280 },
  { name: "Sunshine Daycare Center", type: "daycare", typeColor: COLORS.purple, plan: "Daily Lunch Program (45 meals/day)", nextDelivery: "Mon Mar 23", balance: 340, paid: 0, due: 340 },
  { name: "Williams Household", type: "individual", typeColor: COLORS.teal, plan: "Biweekly Dinner Box (8 meals)", nextDelivery: "Wed Mar 25", balance: 0, paid: 160, due: 160 },
  { name: "Little Stars Learning Center", type: "daycare", typeColor: COLORS.purple, plan: "Daily Lunch Program (30 meals/day)", nextDelivery: "Mon Mar 23", balance: 150, paid: 600, due: 750 },
  { name: "Davis Family", type: "individual", typeColor: COLORS.teal, plan: "Weekly Meal Box (6 meals)", nextDelivery: "Tue Mar 24", balance: 0, paid: 210, due: 210 },
  { name: "Thompson & Associates", type: "business", typeColor: COLORS.blue, plan: "Office Lunch (20 meals, M–F)", nextDelivery: "Mon Mar 23", balance: 480, paid: 200, due: 680 },
];

const scheduleData = {
  "Mon 3/23": [
    { client: "Johnson Family", servings: 10, time: "7:30 AM", type: "delivery", status: "scheduled", dietary: "No pork" },
    { client: "Sunshine Daycare", servings: 45, time: "7:00 AM", type: "delivery", status: "prepared", dietary: "Nut-free facility" },
    { client: "Little Stars Learning", servings: 30, time: "7:15 AM", type: "delivery", status: "scheduled", dietary: "Nut-free, one halal" },
    { client: "Thompson & Assoc.", servings: 20, time: "11:00 AM", type: "delivery", status: "scheduled", dietary: "Vegetarian options needed" },
  ],
  "Tue 3/24": [
    { client: "Davis Family", servings: 6, time: "6:00 PM", type: "pickup", status: "scheduled", dietary: "" },
    { client: "Sunshine Daycare", servings: 45, time: "7:00 AM", type: "delivery", status: "scheduled", dietary: "Nut-free facility" },
    { client: "Thompson & Assoc.", servings: 20, time: "11:00 AM", type: "delivery", status: "scheduled", dietary: "" },
  ],
  "Wed 3/25": [
    { client: "Williams Household", servings: 8, time: "5:30 PM", type: "delivery", status: "scheduled", dietary: "Gluten-free" },
    { client: "Sunshine Daycare", servings: 45, time: "7:00 AM", type: "delivery", status: "scheduled", dietary: "Nut-free" },
    { client: "Thompson & Assoc.", servings: 20, time: "11:00 AM", type: "delivery", status: "scheduled", dietary: "" },
  ],
};

const statusColors = { scheduled: COLORS.muted, prepared: COLORS.blue, delivered: COLORS.green, missed: "#E84040" };

function ClientsView() {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? mockClients
    : filter === "overdue" ? mockClients.filter(c => c.balance > 0)
    : mockClients.filter(c => c.type === filter);

  return (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.cream, fontFamily: "Georgia, serif" }}>Meal Prep Clients</div>
        <button style={{ background: COLORS.fire, color: COLORS.cream, border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Client</button>
      </div>

      {/* Overdue banner */}
      <div style={{ background: `${COLORS.gold}18`, border: `1px solid ${COLORS.gold}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: COLORS.gold, fontSize: 13, fontWeight: 700 }}>💰 3 clients have outstanding balances — $970 total overdue</span>
        <span style={{ color: COLORS.gold, fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>View All Overdue →</span>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {[["all", "All"], ["individual", "Individuals"], ["daycare", "Daycares"], ["business", "Business"], ["overdue", "Overdue"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 12,
            background: filter === val ? COLORS.fire : COLORS.ash + "66",
            color: filter === val ? COLORS.cream : COLORS.muted, fontWeight: filter === val ? 700 : 400
          }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {filtered.map((c, i) => (
          <div key={i} style={{ background: COLORS.smoke, border: `1px solid ${c.balance > 0 ? COLORS.gold + "66" : COLORS.ash + "44"}`, borderRadius: 8, padding: 14, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ color: COLORS.cream, fontWeight: 700, fontSize: 14 }}>{c.name}</div>
              <Badge label={c.type} color={c.typeColor} small />
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>{c.plan}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
              <span style={{ color: COLORS.muted }}>Next: <span style={{ color: COLORS.cream }}>{c.nextDelivery}</span></span>
              {c.balance > 0
                ? <span style={{ color: COLORS.gold, fontWeight: 700 }}>Owes ${c.balance}</span>
                : <span style={{ color: COLORS.green, fontWeight: 700 }}>✓ Paid ${c.paid}</span>
              }
            </div>
            {c.balance > 0 && (
              <button style={{ marginTop: 8, background: COLORS.gold + "22", border: `1px solid ${COLORS.gold}44`, color: COLORS.gold, borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer", width: "100%" }}>
                💰 Log Payment
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleView() {
  const [selectedDay, setSelectedDay] = useState("Mon 3/23");
  const days = Object.keys(scheduleData);
  const dayData = scheduleData[selectedDay] || [];
  const totalServings = dayData.reduce((s, d) => s + d.servings, 0);
  const allDietary = dayData.filter(d => d.dietary).map(d => `${d.client}: ${d.dietary}`);

  return (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.cream, fontFamily: "Georgia, serif" }}>Delivery Schedule</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ background: COLORS.ash, color: COLORS.muted, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>← Prev Week</button>
          <button style={{ background: COLORS.fire, color: COLORS.cream, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>⚡ Generate This Week</button>
          <button style={{ background: COLORS.ash, color: COLORS.muted, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Next Week →</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 14 }}>
        <div>
          {/* Day tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {days.map(d => (
              <button key={d} onClick={() => setSelectedDay(d)} style={{
                padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                background: selectedDay === d ? COLORS.fire : COLORS.ash + "55",
                color: selectedDay === d ? COLORS.cream : COLORS.muted,
                fontWeight: selectedDay === d ? 700 : 400
              }}>{d}</button>
            ))}
          </div>

          {dayData.map((d, i) => (
            <div key={i} style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 8, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ background: COLORS.fire + "22", border: `1px solid ${COLORS.fire}44`, borderRadius: 8, padding: "8px 12px", minWidth: 60, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.fire }}>{d.servings}</div>
                <div style={{ fontSize: 9, color: COLORS.muted, textTransform: "uppercase" }}>meals</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: COLORS.cream, fontWeight: 700, fontSize: 13 }}>{d.client}</span>
                  <Badge label={d.type} color={d.type === "delivery" ? COLORS.blue : COLORS.teal} small />
                </div>
                <div style={{ color: COLORS.muted, fontSize: 12 }}>{d.time} {d.dietary && <span style={{ color: COLORS.gold }}>• ⚠️ {d.dietary}</span>}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                <Badge label={d.status} color={statusColors[d.status] || COLORS.muted} small />
                <button style={{ background: COLORS.green + "22", border: `1px solid ${COLORS.green}44`, color: COLORS.green, borderRadius: 4, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>
                  ✓ Delivered
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Prep summary */}
        <div>
          <div style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 8, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.cream, marginBottom: 10 }}>📊 {selectedDay} Summary</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: COLORS.muted, fontSize: 12 }}>Total servings</span>
              <span style={{ color: COLORS.fire, fontWeight: 800, fontSize: 20 }}>{totalServings}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: COLORS.muted }}>Deliveries</span>
              <span style={{ color: COLORS.cream }}>{dayData.filter(d => d.type === "delivery").length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: COLORS.muted }}>Pickups</span>
              <span style={{ color: COLORS.cream }}>{dayData.filter(d => d.type === "pickup").length}</span>
            </div>
          </div>

          {allDietary.length > 0 && (
            <div style={{ background: `${COLORS.gold}11`, border: `1px solid ${COLORS.gold}33`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.gold, marginBottom: 8 }}>⚠️ Dietary Alerts</div>
              {allDietary.map((note, i) => (
                <div key={i} style={{ fontSize: 11, color: COLORS.cream, marginBottom: 4, lineHeight: 1.5 }}>• {note}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentsView() {
  const payments = [
    { client: "Johnson Family", date: "Mar 15", amount: 280, method: "Zelle", period: "Mar 15–21", status: "paid" },
    { client: "Williams Household", date: "Mar 16", amount: 160, method: "Venmo", period: "Mar 16–29", status: "paid" },
    { client: "Davis Family", date: "Mar 14", amount: 210, method: "Cash", period: "Mar 14–20", status: "paid" },
    { client: "Little Stars Learning", date: "Mar 1", amount: 600, method: "Check", period: "Mar 1–14", status: "paid" },
    { client: "Sunshine Daycare", date: "—", amount: 340, method: "—", period: "Mar 17–21", status: "overdue" },
    { client: "Thompson & Assoc.", date: "Mar 10", amount: 200, method: "Invoice", period: "Mar 1–7", status: "partial" },
    { client: "Little Stars Learning", date: "—", amount: 150, method: "—", period: "Mar 15–21", status: "overdue" },
    { client: "Thompson & Assoc.", date: "—", amount: 480, method: "—", period: "Mar 8–21", status: "overdue" },
  ];

  const sColors = { paid: COLORS.green, overdue: "#E84040", partial: COLORS.gold, pending: COLORS.muted };

  return (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.cream, fontFamily: "Georgia, serif" }}>Payments</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ background: COLORS.ash, color: COLORS.muted, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Export CSV</button>
          <button style={{ background: COLORS.fire, color: COLORS.cream, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Log Payment</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Revenue This Month", val: "$1,450", color: COLORS.green },
          { label: "Outstanding", val: "$970", color: "#E84040" },
          { label: "Active Plans", val: "6", color: COLORS.teal },
          { label: "Deliveries This Week", val: "47", color: COLORS.gold },
        ].map(s => (
          <div key={s.label} style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 100px 90px 90px", padding: "8px 14px", fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${COLORS.ash}33` }}>
          <span>Client</span><span>Date</span><span>Amount</span><span>Method</span><span>Period</span><span>Status</span><span></span>
        </div>
        {payments.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 80px 100px 90px 90px", padding: "10px 14px", fontSize: 12, borderBottom: `1px solid ${COLORS.ash}22`, background: i % 2 === 0 ? "transparent" : COLORS.ash + "11", alignItems: "center" }}>
            <span style={{ color: COLORS.cream, fontWeight: 600 }}>{p.client}</span>
            <span style={{ color: COLORS.muted }}>{p.date}</span>
            <span style={{ color: p.status === "paid" ? COLORS.green : COLORS.fire, fontWeight: 700 }}>${p.amount}</span>
            <span style={{ color: COLORS.muted }}>{p.method}</span>
            <span style={{ color: COLORS.muted, fontSize: 11 }}>{p.period}</span>
            <Badge label={p.status} color={sColors[p.status] || COLORS.muted} small />
            {p.status !== "paid" && (
              <button style={{ background: "transparent", border: `1px solid ${COLORS.gold}55`, color: COLORS.gold, borderRadius: 4, padding: "3px 6px", fontSize: 10, cursor: "pointer" }}>Send Reminder</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function MealPrepModule() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeView, setActiveView] = useState("clients");
  const [copiedIdx, setCopiedIdx] = useState(null);

  const copyPrompt = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2500);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: COLORS.coal, color: COLORS.cream, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: COLORS.smoke, borderBottom: `1px solid ${COLORS.ash}66`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.fire, fontFamily: "Georgia, serif" }}>
            🍱 ZigsOps — Meal Prep Module
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
            Add-on for Zig's Kitchen · Steps 09–14 · Builds on existing ZigsOps app
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: COLORS.coal, borderRadius: 8, padding: 4 }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{
              padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
              background: activeTab === i ? COLORS.fire : "transparent",
              color: activeTab === i ? COLORS.cream : COLORS.muted,
              fontWeight: activeTab === i ? 700 : 400, transition: "all 0.15s"
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Tab 1: Prompts */}
      {activeTab === 0 && (
        <div style={{ padding: 20, overflowY: "auto", maxWidth: 860, margin: "0 auto", width: "100%" }}>
          <div style={{ padding: 14, background: `${COLORS.teal}11`, border: `1px solid ${COLORS.teal}33`, borderRadius: 8, marginBottom: 18, fontSize: 13, color: COLORS.muted, lineHeight: 1.7 }}>
            These are <strong style={{ color: COLORS.cream }}>Steps 09–14</strong>, continuing from the main ZigsOps build guide. Your permits, bookings, and documents modules must be working before starting here. These prompts add 4 new database tables and a full Meal Prep section to the existing app.
          </div>
          {prompts.map((p, i) => (
            <div key={i} style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${COLORS.ash}33`, background: `${COLORS.ash}22` }}>
                <span style={{ background: COLORS.teal, color: COLORS.cream, borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 800, fontFamily: "monospace" }}>STEP {p.step}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.cream }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{p.phase} · {p.timing}</div>
                </div>
                <button onClick={() => copyPrompt(p.prompt, i)} style={{
                  background: copiedIdx === i ? COLORS.green : COLORS.coal,
                  color: COLORS.cream, border: `1px solid ${COLORS.ash}`,
                  borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600, transition: "background 0.2s"
                }}>{copiedIdx === i ? "✓ Copied!" : "Copy Prompt"}</button>
              </div>
              <div style={{ padding: "12px 18px" }}>
                <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 10, lineHeight: 1.6 }}>{p.description}</p>
                <pre style={{ background: COLORS.coal, borderRadius: 8, padding: 14, fontSize: 11.5, color: "#A8D8A0", lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", border: `1px solid ${COLORS.ash}33`, maxHeight: 260, overflowY: "auto" }}>{p.prompt}</pre>
                {p.note && (
                  <div style={{ marginTop: 10, padding: "9px 13px", background: `${COLORS.teal}11`, border: `1px solid ${COLORS.teal}33`, borderRadius: 6, fontSize: 12, color: COLORS.teal }}>
                    💡 <strong>After this step:</strong> {p.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Schema */}
      {activeTab === 1 && (
        <div style={{ padding: 20, overflowY: "auto", maxWidth: 860, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {schemaData.businessLogic.map((bl, i) => (
              <div key={i} style={{ background: COLORS.smoke, border: `1px solid ${bl.color}33`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{bl.icon}</span>
                  <span style={{ fontWeight: 700, color: bl.color, fontSize: 13 }}>{bl.title}</span>
                </div>
                <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>{bl.description}</p>
              </div>
            ))}
          </div>

          {schemaData.tables.map((table, ti) => (
            <div key={ti} style={{ background: COLORS.smoke, border: `1px solid ${COLORS.ash}44`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ padding: "11px 18px", background: `${table.color}22`, borderBottom: `1px solid ${table.color}44`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{table.icon}</span>
                <div>
                  <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: table.color }}>{table.name}</span>
                  <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 10 }}>{table.description}</span>
                </div>
              </div>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "160px 100px 1fr", padding: "7px 18px", fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${COLORS.ash}22` }}>
                  <span>Column</span><span>Type</span><span>Notes</span>
                </div>
                {table.columns.map((col, ci) => (
                  <div key={ci} style={{ display: "grid", gridTemplateColumns: "160px 100px 1fr", padding: "8px 18px", fontSize: 12, borderBottom: `1px solid ${COLORS.ash}18`, background: ci % 2 === 0 ? "transparent" : COLORS.ash + "0A" }}>
                    <span style={{ fontFamily: "monospace", color: table.color, fontWeight: 600 }}>{col.col}</span>
                    <span style={{ fontFamily: "monospace", color: COLORS.muted, fontSize: 11 }}>{col.type}</span>
                    <span style={{ color: COLORS.muted, fontSize: 12 }}>{col.note}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: UI Preview */}
      {activeTab === 2 && (
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 12, fontSize: 13, color: COLORS.muted }}>
            Click the views below to preview each screen of the Meal Prep module.
          </div>
          <div style={{ border: `1px solid ${COLORS.ash}44`, borderRadius: 12, overflow: "hidden", background: COLORS.coal }}>
            {/* Sub-nav */}
            <div style={{ background: COLORS.smoke, borderBottom: `1px solid ${COLORS.ash}44`, padding: "10px 16px", display: "flex", gap: 4 }}>
              {[["clients", "👤 Clients"], ["schedule", "📅 Schedule"], ["payments", "💰 Payments"]].map(([v, l]) => (
                <button key={v} onClick={() => setActiveView(v)} style={{
                  padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                  background: activeView === v ? COLORS.fire : "transparent",
                  color: activeView === v ? COLORS.cream : COLORS.muted, fontWeight: activeView === v ? 700 : 400
                }}>{l}</button>
              ))}
            </div>
            <div style={{ height: 580 }}>
              {activeView === "clients" && <ClientsView />}
              {activeView === "schedule" && <ScheduleView />}
              {activeView === "payments" && <PaymentsView />}
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.muted, textAlign: "center" }}>
            Populated with realistic Zig's Kitchen client data · All views interactive
          </div>
        </div>
      )}
    </div>
  );
}
