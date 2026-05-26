import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.signOut();

  const url = new URL('/login', request.url);
  url.searchParams.set('reason', 'signed_out');
  const response = NextResponse.redirect(url);

  const cookieStore = cookies();
  cookieStore.getAll().forEach(cookie => {
    if (
      cookie.name.startsWith('sb-') ||
      cookie.name.includes('supabase') ||
      cookie.name.includes('auth-token')
    ) {
      response.cookies.set(cookie.name, '', {
        expires: new Date(0),
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
      });
    }
  });

  return response;
}
