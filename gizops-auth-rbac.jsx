import { useState } from "react";

const C = {
  fire: "#E8521A", coal: "#1A1008", smoke: "#2D2416", ash: "#4A3D2E",
  cream: "#F5EDD9", gold: "#D4A84B", muted: "#8A7560",
  green: "#4A9E6B", blue: "#4A7FE8", purple: "#9E4AE8", teal: "#2AA8A0", red: "#E84040"
};

const tabs = ["Build Prompts", "Role Matrix", "UI Preview"];

const prompts = [
  {
    step: "AUTH-1",
    label: "Database — Profiles & RBAC Schema",
    timing: "15 min",
    color: C.purple,
    description: "Run this SQL in Supabase first. Creates the profiles table, role trigger, and all RLS policies across every existing table.",
    prompt: `Run this SQL in Supabase SQL Editor to add authentication and role-based access control to GizOps.

-- ─────────────────────────────────────────────
-- 1. PROFILES TABLE
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  email text,
  role text NOT NULL DEFAULT 'staff'
    CHECK (role IN ('super_admin', 'owner', 'manager', 'staff')),
  account_id uuid,        -- future: links to operator account for multi-tenant
  avatar_url text,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  invited_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_read_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Owners and super_admins can read all profiles in their account
CREATE POLICY "profiles_read_team" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'super_admin')
    )
  );

-- Only super_admin can update roles
CREATE POLICY "profiles_update_role" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────
-- 2. AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'staff')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────
-- 3. UPDATE LAST LOGIN FUNCTION
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles SET last_login_at = now()
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
-- 4. RLS POLICIES — PERMITS TABLE
-- ─────────────────────────────────────────────
-- All authenticated users can view permits
CREATE POLICY "permits_select" ON permits
  FOR SELECT USING (auth.role() = 'authenticated');

-- Owner + manager + super_admin can insert/update
CREATE POLICY "permits_insert" ON permits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'manager', 'super_admin'))
  );

CREATE POLICY "permits_update" ON permits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'manager', 'super_admin'))
  );

-- Only owner + super_admin can delete
CREATE POLICY "permits_delete" ON permits
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'super_admin'))
  );

-- ─────────────────────────────────────────────
-- 5. RLS POLICIES — BOOKINGS TABLE
-- ─────────────────────────────────────────────
CREATE POLICY "bookings_select" ON bookings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "bookings_insert" ON bookings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'manager', 'super_admin'))
  );

CREATE POLICY "bookings_update" ON bookings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'manager', 'super_admin'))
  );

CREATE POLICY "bookings_delete" ON bookings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'super_admin'))
  );

-- ─────────────────────────────────────────────
-- 6. RLS POLICIES — DOCUMENTS TABLE
-- ─────────────────────────────────────────────
CREATE POLICY "documents_select" ON documents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "documents_insert" ON documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'manager', 'super_admin'))
  );

CREATE POLICY "documents_update" ON documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'manager', 'super_admin'))
  );

CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('owner', 'super_admin'))
  );

-- ─────────────────────────────────────────────
-- 7. RLS POLICIES — MEAL PREP TABLES
-- ─────────────────────────────────────────────
-- meal_prep_clients
CREATE POLICY "mpc_select" ON meal_prep_clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "mpc_write" ON meal_prep_clients FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));
CREATE POLICY "mpc_update" ON meal_prep_clients FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));

-- meal_plans
CREATE POLICY "mp_select" ON meal_plans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "mp_write" ON meal_plans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));
CREATE POLICY "mp_update" ON meal_plans FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));

-- meal_prep_deliveries (staff can UPDATE status to mark delivered)
CREATE POLICY "mpd_select" ON meal_prep_deliveries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "mpd_insert" ON meal_prep_deliveries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));
CREATE POLICY "mpd_update" ON meal_prep_deliveries FOR UPDATE USING (auth.role() = 'authenticated');

-- meal_prep_payments (owner + manager only)
CREATE POLICY "mpp_select" ON meal_prep_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));
CREATE POLICY "mpp_write" ON meal_prep_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));

-- ─────────────────────────────────────────────
-- 8. RLS POLICIES — INVENTORY TABLES
-- ─────────────────────────────────────────────
-- All can view inventory
CREATE POLICY "inv_items_select" ON inventory_items FOR SELECT USING (auth.role() = 'authenticated');
-- Owner + manager can edit items
CREATE POLICY "inv_items_write" ON inventory_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));
CREATE POLICY "inv_items_update" ON inventory_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));

-- Transactions: all authenticated can insert (staff logs usage)
CREATE POLICY "inv_tx_select" ON inventory_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_tx_insert" ON inventory_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Shopping list: owner + manager
CREATE POLICY "inv_shop_select" ON inventory_shopping_list FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inv_shop_write" ON inventory_shopping_list FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','manager','super_admin')));
CREATE POLICY "inv_shop_update" ON inventory_shopping_list FOR UPDATE USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- 9. SET INITIAL ACCOUNTS (run manually after)
-- ─────────────────────────────────────────────
-- After creating George's account and your account
-- in Supabase Auth, run these to assign roles:

-- Set George as owner:
-- UPDATE profiles SET role = 'owner' WHERE email = 'george@zigskitchen.com';

-- Set Erica as super_admin:
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'your@email.com';`,
    note: "After running: go to Supabase → Authentication → Users → create George's account and yours. Then run the two UPDATE statements at the bottom to assign roles."
  },
  {
    step: "AUTH-2",
    label: "Auth Context & useUser Hook",
    timing: "30 min",
    color: C.blue,
    description: "Builds the auth context that wraps the entire app — every component can access the current user's role with a single hook.",
    prompt: `Create the authentication context and user hook for GizOps.

FILE: lib/auth-context.tsx

'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Role = 'super_admin' | 'owner' | 'manager' | 'staff';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  account_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

type AuthContextType = {
  user: any;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  canEdit: boolean;      // owner + manager + super_admin
  canDelete: boolean;    // owner + super_admin only
  canViewPayments: boolean; // owner + manager + super_admin
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setProfile(data);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const role = profile?.role ?? null;

  const value = {
    user,
    profile,
    role,
    loading,
    isSuperAdmin: role === 'super_admin',
    isOwner: role === 'owner',
    isManager: role === 'manager',
    isStaff: role === 'staff',
    canEdit: ['super_admin', 'owner', 'manager'].includes(role ?? ''),
    canDelete: ['super_admin', 'owner'].includes(role ?? ''),
    canViewPayments: ['super_admin', 'owner', 'manager'].includes(role ?? ''),
    signOut: async () => {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useUser = () => useContext(AuthContext);

Then wrap the entire app in AuthProvider.
FILE: app/layout.tsx — add AuthProvider around children.`,
    note: "This is the foundation everything else builds on. After this, any component can call useUser() to get the current user's role and permissions."
  },
  {
    step: "AUTH-3",
    label: "Login Page & Route Middleware",
    timing: "45 min",
    color: C.fire,
    description: "Builds the GizOps login page and the middleware that protects every route — unauthenticated users always land on /login.",
    prompt: `Build the GizOps login page and route protection middleware.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 1: app/login/page.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Design a clean, professional login page with GizOps branding.

Layout (full screen, dark theme):
- Center card on dark coal background (#1A1008)
- Top: GizOps logo/name in fire orange (#E8521A)
- Tagline: "Operations built for food truck operators"
- Form:
  * Email input
  * Password input  
  * "Sign In" button (fire orange, full width)
  * Loading spinner while authenticating
- Error message area (red, shows invalid credentials)
- Footer: "GizOps · Invitation only" (no public signup link)
- NO "forgot password" or "sign up" links visible

On successful login:
- Redirect to /dashboard
- Show toast: "Welcome back, [first name]!"

On error:
- Show: "Invalid email or password. Contact your admin."

Use createClientComponentClient from @supabase/auth-helpers-nextjs.
Call supabase.auth.signInWithPassword({ email, password }).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 2: middleware.ts (project root)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Role requirements per route prefix
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/reports': ['owner', 'manager', 'super_admin'],
  '/settings/users': ['owner', 'super_admin'],
  '/settings': ['owner', 'super_admin'],
  '/payments': ['owner', 'manager', 'super_admin'],
};

// Public routes that never require auth
const PUBLIC_ROUTES = ['/login'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;

  // Allow public routes
  if (PUBLIC_ROUTES.some(r => path.startsWith(r))) {
    // If logged in and hitting /login, redirect to dashboard
    if (session) return NextResponse.redirect(new URL('/dashboard', req.url));
    return res;
  }

  // Require authentication for all other routes
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Check role-based route access
  for (const [route, roles] of Object.entries(PROTECTED_ROUTES)) {
    if (path.startsWith(route)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile || !roles.includes(profile.role)) {
        // Redirect to dashboard with access denied param
        const url = new URL('/dashboard', req.url);
        url.searchParams.set('error', 'access_denied');
        return NextResponse.redirect(url);
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 3: Dashboard access denied toast
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In app/dashboard/page.tsx, check for error param:
If URL has ?error=access_denied, show toast:
"You don't have permission to view that page."`,
    note: "After building: test by visiting /reports in an incognito window — you should be redirected to /login. Then log in as a staff user and try /reports — you should be redirected to /dashboard with the error toast."
  },
  {
    step: "AUTH-4",
    label: "RoleGuard Component & Sidebar Updates",
    timing: "45 min",
    color: C.teal,
    description: "The RoleGuard component hides UI elements based on role. Apply it throughout the app so staff see a clean, simplified interface.",
    prompt: `Build the RoleGuard component and update the GizOps UI for role-based display.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 1: components/RoleGuard.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
'use client';
import { useUser } from '@/lib/auth-context';

type Role = 'super_admin' | 'owner' | 'manager' | 'staff';

type RoleGuardProps = {
  roles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode; // what to show if no access
};

export function RoleGuard({ roles, children, fallback = null }: RoleGuardProps) {
  const { role, loading } = useUser();
  if (loading) return null;
  if (!role || !roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

// Convenience components
export const OwnerOnly = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard roles={['owner', 'super_admin']}>{children}</RoleGuard>
);

export const ManagerAndAbove = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard roles={['owner', 'manager', 'super_admin']}>{children}</RoleGuard>
);

export const SuperAdminOnly = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard roles={['super_admin']}>{children}</RoleGuard>
);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 2: Update sidebar navigation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In the sidebar component, wrap nav items with RoleGuard:

ALL users see:
- Dashboard
- Meal Prep → Schedule
- POS (when built)

Manager + above see:
- Permits
- Bookings
- Meal Prep → Clients, Payments
- Inventory
- Documents

Owner + above see:
- Reports
- Settings

Super admin sees (extra):
- Admin panel link (when built)

Also update sidebar footer:
- Show: avatar circle with user initials
- Show: full_name and role badge
- Logout button

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 3: Apply RoleGuard throughout app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply these guards:

BOOKINGS page:
<ManagerAndAbove>
  <Button>+ New Booking</Button>
</ManagerAndAbove>
<ManagerAndAbove>
  <Button>Send Invoice</Button>
</ManagerAndAbove>
<OwnerOnly>
  <Button>Delete Booking</Button>
</OwnerOnly>

PAYMENTS section:
<ManagerAndAbove>
  {/* Show actual payment amounts */}
  <span>${amount}</span>
</ManagerAndAbove>
<RoleGuard roles={['staff']} fallback={<span>${amount}</span>}>
  {/* Staff sees amounts but not log payment button */}
</RoleGuard>
<ManagerAndAbove>
  <Button>Log Payment</Button>
</ManagerAndAbove>

INVENTORY page:
All users see stock levels.
<ManagerAndAbove>
  <Button>+ Restock</Button>
  <Button>Edit Item</Button>
</ManagerAndAbove>
Staff sees view-only with no edit controls.

PERMITS page:
All users see permit list.
<ManagerAndAbove>
  <Button>+ Add Permit</Button>
  <Button>Edit</Button>
</ManagerAndAbove>

DASHBOARD:
<ManagerAndAbove>
  <RevenueCard /> {/* Hide revenue from staff */}
</ManagerAndAbove>
Staff dashboard shows: Today's deliveries, schedule, low stock alerts only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 4: Staff-specific dashboard view
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In app/dashboard/page.tsx:
const { isStaff } = useUser();

If isStaff: show simplified dashboard:
- "Today's Deliveries" — meal prep schedule for today
- "Upcoming Events" — confirmed bookings only (no quotes/amounts)
- "Low Stock" — inventory alerts
- NO revenue cards
- NO payment outstanding alerts
- NO permit expiration details (just a green/amber/red indicator)`,
    note: "Test by logging in as each role. Staff user should see a stripped sidebar and no financial information. Owner should see everything."
  },
  {
    step: "AUTH-5",
    label: "User Management Page",
    timing: "1 hour",
    color: C.gold,
    description: "Owner-only page where George can view his team, invite new users by email, change roles, and deactivate accounts.",
    prompt: `Build the User Management page for GizOps at app/settings/users/page.tsx.
This page is visible to owner and super_admin roles only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Header: "Team" with "+ Invite User" button (top right)

USER LIST TABLE:
Columns: Avatar | Name | Email | Role | Last Login | Status | Actions

Each row:
- Avatar circle with initials (colored by role)
- Full name
- Email
- Role badge (color-coded):
  super_admin → purple
  owner → fire orange
  manager → gold
  staff → gray/muted
- Last login: "2 hours ago" / "3 days ago" / "Never"
- Status badge: Active (green) / Inactive (red)
- Actions:
  * Change role dropdown (owner can change manager/staff only)
  * Deactivate toggle
  * Remove user (owner only, can't remove themselves)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVITE USER MODAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fields:
- Email address
- Full name
- Role selector:
  * Manager — can manage bookings, meal prep, inventory
  * Staff — can view schedule and use POS only
  (Owner cannot be assigned here — set directly)
- "Send Invite" button

On submit:
- Call supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role }
  })
- Shows success: "Invite sent to [email]. They'll receive
  a link to set their password."
- New user appears in list with status "Invited"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROLE CHANGE LOGIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner can:
- Promote staff → manager
- Demote manager → staff
- Deactivate any user except themselves
- Cannot change another owner's role
- Cannot change super_admin role

Super admin can:
- Change any role including owner
- Reactivate deactivated users

On role change:
- Update profiles table
- Show toast: "[Name]'s role updated to [role]"

On deactivate:
- Set is_active = false in profiles
- Supabase: revoke their session
- Show toast: "[Name] has been deactivated"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT USER CARD (top of page)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Show a card with the logged-in user's own info:
- Name, email, role
- "This is you" badge
- Change password link (triggers Supabase reset email)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LINK IN SIDEBAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add to sidebar under Settings (owner only):
👥 Team

Add to sidebar footer below logout:
Show current user's name, role badge, and avatar.`,
    note: "First user to create: George (role: owner). Second: yourself (role: super_admin). Then George can invite his own staff from this page."
  },
  {
    step: "AUTH-6",
    label: "Logout, Session & Final Polish",
    timing: "30 min",
    color: C.green,
    description: "Logout button, session persistence, loading states, and making sure the auth flow feels smooth on George's phone.",
    prompt: `Add final auth polish to GizOps.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. LOGOUT BUTTON IN SIDEBAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In the sidebar footer:
- User avatar circle (initials, colored by role)
- Full name + role badge
- Logout button (icon + text, bottom of sidebar)

On logout:
- Call signOut() from useUser()
- Clear local state
- Redirect to /login
- Show: "You've been signed out"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. SESSION PERSISTENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In Supabase Dashboard → Authentication → 
Settings → JWT expiry: set to 604800 (7 days)

In createClientComponentClient config:
auth: {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true
}

This keeps George logged in for 7 days on his phone
without asking him to sign in again.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. LOADING STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
While auth is loading (checking session):
- Show full-screen loading state:
  GizOps logo centered, fire orange
  Subtle pulse animation
  No flash of unauthenticated content

In app/layout.tsx:
const { loading } = useUser();
if (loading) return <GizOpsLoadingScreen />;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. MOBILE AUTH EXPERIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
On the login page for mobile:
- Large touch targets (min 44px height)
- Email input: type="email" (mobile keyboard)
- Password input: type="password"
- autocomplete="current-password" on password
- autocomplete="email" on email
- "Sign In" button: large, full width, easy to tap

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. PASSWORD RESET FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add a small "Forgot password?" link on login page.
On click: ask for email → call:
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://gizops.com/auth/reset-password'
})
Show: "Check your email for a reset link"

Create app/auth/reset-password/page.tsx:
- New password + confirm password inputs
- On submit: supabase.auth.updateUser({ password })
- Redirect to /dashboard on success

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. FINAL TEST CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After building, verify:
□ /login loads without being logged in
□ Wrong password shows error message
□ Correct password → dashboard redirect
□ Visiting /reports as staff → dashboard + toast
□ Visiting any page without login → /login redirect
□ Logout → /login redirect
□ Refresh page → stays logged in (session persists)
□ Mobile: login works on George's iPhone
□ PWA: after install, auto-login on reopen`,
    note: "This is the last auth step. After this, GizOps is fully secured. Run the full test checklist at the bottom before calling auth complete."
  }
];

// ─── ROLE MATRIX ─────────────────────────────────────────────────────────────

const roles = ["super_admin", "owner", "manager", "staff"];
const roleColors = {
  super_admin: C.purple, owner: C.fire, manager: C.gold, staff: C.muted
};
const roleLabels = {
  super_admin: "Super Admin", owner: "Owner", manager: "Manager", staff: "Staff"
};

const matrixRows = [
  { section: "Dashboard", items: [
    { label: "View dashboard", access: [true, true, true, true] },
    { label: "View revenue numbers", access: [true, true, true, false] },
    { label: "View alert banners", access: [true, true, true, "limited"] },
  ]},
  { section: "Permits", items: [
    { label: "View permits", access: [true, true, true, true] },
    { label: "Add / edit permits", access: [true, true, true, false] },
    { label: "Delete permits", access: [true, true, false, false] },
    { label: "Upload permit docs", access: [true, true, true, false] },
  ]},
  { section: "Bookings", items: [
    { label: "View bookings", access: [true, true, true, false] },
    { label: "Create / edit bookings", access: [true, true, true, false] },
    { label: "Delete bookings", access: [true, true, false, false] },
    { label: "Send confirmation email", access: [true, true, true, false] },
    { label: "Generate invoice", access: [true, true, true, false] },
    { label: "Send invoice", access: [true, true, true, false] },
  ]},
  { section: "Meal Prep", items: [
    { label: "View delivery schedule", access: [true, true, true, true] },
    { label: "Mark delivery complete", access: [true, true, true, true] },
    { label: "Manage clients & plans", access: [true, true, true, false] },
    { label: "View payments", access: [true, true, true, false] },
    { label: "Log payments", access: [true, true, true, false] },
    { label: "Send payment reminders", access: [true, true, true, false] },
  ]},
  { section: "Inventory", items: [
    { label: "View stock levels", access: [true, true, true, true] },
    { label: "Log usage / restock", access: [true, true, true, "limited"] },
    { label: "Add / edit items", access: [true, true, true, false] },
    { label: "View shopping list", access: [true, true, true, true] },
    { label: "Manage shopping list", access: [true, true, true, false] },
  ]},
  { section: "Payments & Finance", items: [
    { label: "View payment amounts", access: [true, true, true, false] },
    { label: "Log payments", access: [true, true, true, false] },
    { label: "View reports", access: [true, true, true, false] },
    { label: "Export CSV", access: [true, true, true, false] },
  ]},
  { section: "POS", items: [
    { label: "Use POS screen", access: [true, true, true, true] },
    { label: "Process payments", access: [true, true, true, true] },
    { label: "View daily sales log", access: [true, true, true, false] },
  ]},
  { section: "Settings & Admin", items: [
    { label: "View settings", access: [true, true, false, false] },
    { label: "Invite users", access: [true, true, false, false] },
    { label: "Change user roles", access: [true, true, false, false] },
    { label: "Deactivate users", access: [true, true, false, false] },
    { label: "Access all operator accounts", access: [true, false, false, false] },
    { label: "Manage billing", access: [true, true, false, false] },
  ]},
];

function AccessIcon({ value }) {
  if (value === true) return <span style={{ color: C.green, fontSize: 14, fontWeight: 800 }}>✓</span>;
  if (value === false) return <span style={{ color: C.red, fontSize: 14 }}>✕</span>;
  if (value === "limited") return <span style={{ color: C.gold, fontSize: 12, fontWeight: 700 }}>~</span>;
  return null;
}

function RoleMatrixView() {
  return (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {roles.map(r => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", background: roleColors[r] + "22", border: `1px solid ${roleColors[r]}44`, borderRadius: 20 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: roleColors[r] }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: roleColors[r] }}>{roleLabels[r]}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <span style={{ color: C.green }}>✓</span> full access
          <span style={{ color: C.gold }}>~</span> limited
          <span style={{ color: C.red }}>✕</span> no access
        </div>
      </div>

      <div style={{ background: C.smoke, border: `1px solid ${C.ash}44`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px", padding: "8px 14px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.ash}44`, background: C.coal }}>
          <span>Permission</span>
          {roles.map(r => <span key={r} style={{ textAlign: "center", color: roleColors[r] }}>{roleLabels[r].split(" ")[0]}</span>)}
        </div>

        {matrixRows.map((section, si) => (
          <div key={si}>
            <div style={{ padding: "8px 14px", background: C.ash + "33", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.ash}33` }}>
              {section.section}
            </div>
            {section.items.map((item, ii) => (
              <div key={ii} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px", padding: "8px 14px", fontSize: 12, borderBottom: `1px solid ${C.ash}22`, background: ii % 2 === 0 ? "transparent" : C.ash + "0A", alignItems: "center" }}>
                <span style={{ color: C.cream }}>{item.label}</span>
                {item.access.map((a, ai) => (
                  <div key={ai} style={{ textAlign: "center" }}>
                    <AccessIcon value={a} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UI PREVIEW ───────────────────────────────────────────────────────────────

function LoginPreview() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, padding: 24 }}>
      <div style={{ width: 340, background: C.smoke, border: `1px solid ${C.ash}55`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ background: C.coal, padding: "28px 32px", textAlign: "center", borderBottom: `1px solid ${C.ash}44` }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.fire, fontFamily: "Georgia, serif" }}>GizOps</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontStyle: "italic" }}>Operations built for food truck operators</div>
        </div>
        <div style={{ padding: "24px 28px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</div>
            <div style={{ background: C.coal, border: `1px solid ${C.ash}66`, borderRadius: 6, padding: "10px 12px", fontSize: 13, color: C.cream }}>george@zigskitchen.com</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</div>
            <div style={{ background: C.coal, border: `1px solid ${C.ash}66`, borderRadius: 6, padding: "10px 12px", fontSize: 13, color: C.muted }}>••••••••••••</div>
          </div>
          <div style={{ background: C.fire, borderRadius: 8, padding: "12px", textAlign: "center", fontSize: 14, fontWeight: 700, color: C.cream, cursor: "pointer" }}>Sign In</div>
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: C.muted }}>Forgot password? · GizOps · Invitation only</div>
        </div>
      </div>
    </div>
  );
}

function SidebarPreview({ role }) {
  const rc = roleColors[role];
  const rl = roleLabels[role];

  const allItems = [
    { label: "Dashboard", icon: "⬛", roles: ["super_admin","owner","manager","staff"] },
    { label: "Permits", icon: "🏛️", roles: ["super_admin","owner","manager"] },
    { label: "Bookings", icon: "📋", roles: ["super_admin","owner","manager"] },
    { label: "Meal Prep", icon: "🍱", roles: ["super_admin","owner","manager","staff"] },
    { label: "Inventory", icon: "🧂", roles: ["super_admin","owner","manager"] },
    { label: "Documents", icon: "📁", roles: ["super_admin","owner","manager"] },
    { label: "Reports", icon: "📊", roles: ["super_admin","owner","manager"] },
    { label: "POS", icon: "💳", roles: ["super_admin","owner","manager","staff"] },
    { label: "Settings", icon: "⚙️", roles: ["super_admin","owner"] },
  ];

  const visible = allItems.filter(i => i.roles.includes(role));

  return (
    <div style={{ width: 180, background: C.smoke, borderRight: `1px solid ${C.ash}44`, display: "flex", flexDirection: "column", borderRadius: "8px 0 0 8px", overflow: "hidden" }}>
      <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${C.ash}44` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.fire, fontFamily: "Georgia, serif" }}>GizOps</div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Zig's Kitchen</div>
      </div>
      <nav style={{ flex: 1, padding: "10px 0" }}>
        {visible.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", fontSize: 12, color: i === 0 ? C.cream : C.muted, background: i === 0 ? `${C.fire}22` : "transparent", borderLeft: i === 0 ? `3px solid ${C.fire}` : "3px solid transparent", fontWeight: i === 0 ? 700 : 400 }}>
            <span style={{ fontSize: 12 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.ash}44` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: rc + "33", border: `1.5px solid ${rc}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: rc }}>
            {role === "super_admin" ? "EA" : role === "owner" ? "GZ" : role === "manager" ? "MJ" : "TW"}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.cream }}>{role === "super_admin" ? "Erica L." : role === "owner" ? "George Z." : role === "manager" ? "Marcus J." : "Tamara W."}</div>
            <div style={{ fontSize: 9, color: rc, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{rl}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, cursor: "pointer", textAlign: "center", padding: "4px", border: `1px solid ${C.ash}44`, borderRadius: 4 }}>Sign out</div>
      </div>
    </div>
  );
}

function UIPreviewView() {
  const [previewRole, setPreviewRole] = useState("owner");
  const [screen, setScreen] = useState("sidebar");

  return (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center" }}>Preview as:</div>
        {roles.map(r => (
          <button key={r} onClick={() => setPreviewRole(r)} style={{ padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 11, background: previewRole === r ? roleColors[r] : C.ash + "66", color: previewRole === r ? C.cream : C.muted, fontWeight: previewRole === r ? 700 : 400 }}>
            {roleLabels[r]}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {[["sidebar", "Sidebar"], ["login", "Login Page"]].map(([v, l]) => (
            <button key={v} onClick={() => setScreen(v)} style={{ padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 11, background: screen === v ? C.fire : C.ash + "55", color: screen === v ? C.cream : C.muted }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: `1px solid ${C.ash}44`, borderRadius: 10, overflow: "hidden", display: "flex", minHeight: 480, background: C.coal }}>
        {screen === "sidebar" ? (
          <>
            <SidebarPreview role={previewRole} />
            <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.cream }}>
                {previewRole === "staff" ? "Staff view — simplified dashboard" : previewRole === "owner" ? "Owner view — full access" : previewRole === "manager" ? "Manager view — no settings/billing" : "Super Admin view — all accounts"}
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
                {previewRole === "staff" && "Staff members see: Today's delivery schedule, meal prep tasks, POS screen. No financial data, no bookings, no reports."}
                {previewRole === "owner" && "Owners see everything: Full dashboard with revenue, all modules, reports, settings, and team management."}
                {previewRole === "manager" && "Managers see: All operational modules (bookings, meal prep, inventory, payments) but no settings or billing."}
                {previewRole === "super_admin" && "Super admins see everything across all operator accounts. Used by ACIRE for support and platform management."}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {["Dashboard", "Permits", "Bookings", "Meal Prep", "Inventory", "Documents", "Reports", "POS", "Settings"].map(page => {
                  const hasAccess = previewRole === "super_admin" || previewRole === "owner" ? true
                    : previewRole === "manager" ? !["Settings"].includes(page)
                    : ["Dashboard", "Meal Prep", "POS"].includes(page);
                  return (
                    <div key={page} style={{ padding: "4px 10px", borderRadius: 4, fontSize: 11, background: hasAccess ? C.green + "22" : C.red + "11", border: `1px solid ${hasAccess ? C.green + "44" : C.red + "33"}`, color: hasAccess ? C.green : C.red, fontWeight: 600 }}>
                      {hasAccess ? "✓" : "✕"} {page}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <LoginPreview />
        )}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function AuthRBACGuide() {
  const [activeTab, setActiveTab] = useState(0);
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
          <div style={{ fontSize: 17, fontWeight: 800, color: C.fire, fontFamily: "Georgia, serif" }}>🔐 GizOps — Auth & RBAC</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Steps AUTH-1 through AUTH-6 · Login · Role guards · User management</div>
        </div>
        <div style={{ display: "flex", gap: 4, background: C.coal, borderRadius: 8, padding: 4 }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, background: activeTab === i ? C.fire : "transparent", color: activeTab === i ? C.cream : C.muted, fontWeight: activeTab === i ? 700 : 400, transition: "all .15s" }}>{t}</button>
          ))}
        </div>
      </div>

      {activeTab === 0 && (
        <div style={{ padding: 20, overflowY: "auto", maxWidth: 860, margin: "0 auto", width: "100%" }}>
          <div style={{ padding: 12, background: `${C.purple}11`, border: `1px solid ${C.purple}33`, borderRadius: 8, marginBottom: 16, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
            Run these <strong style={{ color: C.cream }}>in order AUTH-1 through AUTH-6</strong>. Start with the SQL (AUTH-1), then build outward. <strong style={{ color: C.fire }}>Build this before deploying to gizops.com</strong> — the app should never be publicly accessible without login.
          </div>
          {prompts.map((p, i) => (
            <div key={i} style={{ background: C.smoke, border: `1px solid ${C.ash}44`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${C.ash}33`, background: `${C.ash}22` }}>
                <span style={{ background: p.color, color: C.cream, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 800, fontFamily: "monospace" }}>{p.step}</span>
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
                <pre style={{ background: C.coal, borderRadius: 8, padding: 12, fontSize: 11, color: "#A8D8A0", lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", border: `1px solid ${C.ash}33`, maxHeight: 260, overflowY: "auto" }}>{p.prompt}</pre>
                {p.note && <div style={{ marginTop: 8, padding: "8px 12px", background: `${p.color}11`, border: `1px solid ${p.color}33`, borderRadius: 6, fontSize: 12, color: p.color }}>💡 {p.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 1 && <RoleMatrixView />}
      {activeTab === 2 && <UIPreviewView />}
    </div>
  );
}
