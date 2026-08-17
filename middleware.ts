import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROLE_ROUTES: Record<string, string[]> = {
  '/reports': ['owner', 'manager', 'super_admin'],
  '/settings/users': ['owner', 'super_admin'],
  '/settings': ['owner', 'super_admin'],
  '/payments': ['owner', 'manager', 'super_admin'],
  '/invoices': ['owner', 'manager', 'super_admin'],
  '/receipts': ['owner', 'manager', 'super_admin'],
};

const PUBLIC_ROUTES = ['/login', '/auth'];

type ActiveProfile = {
  role: string;
  is_active: boolean;
  password_change_required?: boolean;
};

async function getActiveProfile(
  userId: string,
  fallbackClient: ReturnType<typeof createMiddlewareClient>
): Promise<ActiveProfile | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const profileClient = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : fallbackClient;

  let profile: ActiveProfile | null = null;
  const { data: profileWithPasswordFlag, error: profileError } = await profileClient
    .from('profiles')
    .select('role, is_active, password_change_required')
    .eq('id', userId)
    .single();
  profile = profileWithPasswordFlag;

  if (profileError) {
    const fallback = await profileClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', userId)
      .single();
    profile = fallback.data;
  }

  return profile?.is_active ? profile : null;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;

  if (path === '/auth/signout') {
    return res;
  }

  let activeProfile: ActiveProfile | null = null;
  if (session) {
    activeProfile = await getActiveProfile(session.user.id, supabase);
  }

  // Auth helper routes, including password reset links, must stay reachable even
  // when the browser already has a session.
  if (path.startsWith('/auth')) {
    return res;
  }

  // Public routes: redirect authenticated users with an active profile away from login.
  // If the saved browser session has no active profile, allow login so the app can clear it.
  if (PUBLIC_ROUTES.some((r) => path.startsWith(r))) {
    if (path === '/login' && req.nextUrl.searchParams.get('force') === '1') return res;
    if (session && activeProfile) return NextResponse.redirect(new URL('/dashboard', req.url));
    return res;
  }

  // All other routes require authentication
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (!activeProfile) {
    const url = new URL('/login', req.url);
    url.searchParams.set('reason', 'profile');
    return NextResponse.redirect(url);
  }

  if (activeProfile.password_change_required && path !== '/auth/change-password') {
    return NextResponse.redirect(new URL('/auth/change-password', req.url));
  }

  // Role-based route protection
  for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
    if (path.startsWith(route)) {
      if (!roles.includes(activeProfile.role)) {
        const url = new URL('/dashboard', req.url);
        url.searchParams.set('error', 'access_denied');
        return NextResponse.redirect(url);
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
