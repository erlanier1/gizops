import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROLE_ROUTES: Record<string, string[]> = {
  '/reports': ['owner', 'manager', 'super_admin'],
  '/settings/users': ['owner', 'super_admin'],
  '/settings': ['owner', 'super_admin'],
  '/payments': ['owner', 'manager', 'super_admin'],
};

const PUBLIC_ROUTES = ['/login', '/auth'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;

  // Public routes: redirect authenticated users away from login
  if (PUBLIC_ROUTES.some((r) => path.startsWith(r))) {
    if (session) return NextResponse.redirect(new URL('/dashboard', req.url));
    return res;
  }

  // All other routes require authentication
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Role-based route protection
  for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
    if (path.startsWith(route)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile || !roles.includes(profile.role)) {
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
