// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ROLE_HOME: Record<string, string> = {
  customer:   '/customer/dashboard',
  admin:      '/admin/dashboard',
  warehouse:  '/warehouse/dashboard',
  management: '/management/analytics',
  supplier:   '/supplier/dashboard',
};

const PUBLIC_PATHS = ['/auth/login', '/auth/callback'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    // If already logged in, redirect to role home
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const home = ROLE_HOME[profile?.role ?? ''] ?? '/auth/login';
      return NextResponse.redirect(new URL(home, request.url));
    }
    return supabaseResponse;
  }

  // Root redirect
  if (pathname === '/') {
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const home = ROLE_HOME[profile?.role ?? ''] ?? '/auth/login';
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Protected routes — must be authenticated
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Role-path enforcement
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role as string | undefined;
  if (!role) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // management inherits all admin access
  const allowed = (() => {
    if (pathname.startsWith('/customer'))   return role === 'customer';
    if (pathname.startsWith('/admin'))      return role === 'admin' || role === 'management';
    if (pathname.startsWith('/warehouse'))  return role === 'warehouse';
    if (pathname.startsWith('/supplier'))   return role === 'supplier';
    if (pathname.startsWith('/management')) return role === 'management';
    return true;
  })();

  if (!allowed) {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/auth/login', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
